const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const db = require('./db');
const { encryptSecret, decryptSecret } = require('./credentialCrypto');

// ---------------------------------------------------------------------------
// Self-hosted Mailcow integration — the alternative to mailgunClient.js once
// a real Mailcow instance is running (see the setup guide delivered
// separately). Mirrors mailgunClient.js's exported function shape
// (isConfigured / createMailboxForAccount / sendMailAs) so emailProvider.js
// can switch between the two with no changes needed in the route handlers
// that call it.
//
// KEY DESIGN DECISION: this does NOT change the mailbox owner's login
// experience. They still log into Altegic's own webmail UI with the
// webmailPassword this app already generates and hashes (webmailAuth.js,
// unchanged) — exactly as with Mailgun. Underneath, a SEPARATE, real
// Mailcow mailbox is created with its OWN password, used only by this
// app's own server to authenticate SMTP sends and IMAP fetches on the
// mailbox owner's behalf. That Mailcow password is never shown to the
// mailbox owner and never doubles as their webmail login — keeping the
// existing auth model intact rather than exposing raw mail-server
// credentials to end users.
//
// Requires (once a real Mailcow instance exists):
//   MAILCOW_API_URL   e.g. https://mail.altegic.co.za
//   MAILCOW_API_KEY   a read-write key from Mailcow's admin UI
//   MAILCOW_DOMAIN    the domain mailboxes are created under
//   MAILCOW_SMTP_HOST / MAILCOW_SMTP_PORT   (587, STARTTLS, by default)
//   MAILCOW_IMAP_HOST / MAILCOW_IMAP_PORT   (993, TLS, by default)
//   MAILCOW_CREDENTIAL_ENCRYPTION_KEY   see credentialCrypto.js
// The app server's own outbound IP must be added to Mailcow's API
// allow-list (Configuration > Access > API) — Mailcow rejects API calls
// from any IP not explicitly allow-listed, regardless of API key validity.
// ---------------------------------------------------------------------------

const MAILCOW_API_URL = process.env.MAILCOW_API_URL;
const MAILCOW_API_KEY = process.env.MAILCOW_API_KEY;
const MAILCOW_DOMAIN = process.env.MAILCOW_DOMAIN;
const MAILCOW_SMTP_HOST = process.env.MAILCOW_SMTP_HOST;
const MAILCOW_SMTP_PORT = parseInt(process.env.MAILCOW_SMTP_PORT || '587', 10);
const MAILCOW_IMAP_HOST = process.env.MAILCOW_IMAP_HOST;
const MAILCOW_IMAP_PORT = parseInt(process.env.MAILCOW_IMAP_PORT || '993', 10);

function isMailcowConfigured() {
  return Boolean(MAILCOW_API_URL && MAILCOW_API_KEY && MAILCOW_DOMAIN && MAILCOW_SMTP_HOST && MAILCOW_IMAP_HOST);
}

function apiHeaders() {
  return { 'X-API-Key': MAILCOW_API_KEY, 'Content-Type': 'application/json' };
}

/**
 * Creates a real mailbox on the Mailcow server via its REST API, then
 * records it locally exactly like mailgunClient.js does — same
 * db.mailboxes shape, same webmailPassword/webmailPasswordHash pattern,
 * so nothing calling this needs to know which provider is underneath.
 */
async function createMailboxForAccount(ownerId, localPart, forwardTo) {
  const address = `${localPart}@${MAILCOW_DOMAIN}`;

  const dup = db.mailboxes.find((m) => m.ownerId === ownerId && m.address === address);
  if (dup) {
    const err = new Error(`${address} already exists on this account`);
    err.status = 409;
    throw err;
  }

  // The mailbox's OWN Mailcow password — internal use only, never shown
  // to the mailbox owner. Generated separately from webmailPassword below.
  const mailcowPassword = crypto.randomBytes(18).toString('base64url');

  let response;
  try {
    response = await fetch(`${MAILCOW_API_URL}/api/v1/add/mailbox`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({
        local_part: localPart,
        domain: MAILCOW_DOMAIN,
        password: mailcowPassword,
        password2: mailcowPassword,
        name: address,
        active: '1',
        quota: '3072' // MB; a reasonable default, adjustable per-mailbox later in Mailcow's own UI
      })
    });
  } catch (err) {
    const wrapped = new Error(`Could not reach the Mailcow server at ${MAILCOW_API_URL} (${err.message}). Check MAILCOW_API_URL and that the server is running.`);
    wrapped.status = 502;
    throw wrapped;
  }

  const rawBody = await response.text();
  let data;
  try {
    data = JSON.parse(rawBody);
  } catch {
    const err = new Error('Mailcow did not return a valid response. Check MAILCOW_API_URL and that this server\'s IP is allow-listed in Mailcow\'s API settings.');
    err.status = response.status || 502;
    throw err;
  }
  // Mailcow's add/mailbox returns an array with a "type": "success"|"error" object
  const result = Array.isArray(data) ? data[0] : data;
  if (!response.ok || !result || result.type === 'error') {
    const err = new Error((result && result.msg) ? String(result.msg) : 'Mailcow error creating mailbox');
    err.status = response.status >= 400 ? response.status : 502;
    err.data = data;
    throw err;
  }

  const mailboxId = crypto.randomUUID();
  const webmailPassword = crypto.randomBytes(9).toString('base64url');
  const webmailPasswordHash = await bcrypt.hash(webmailPassword, 10);

  const record = {
    id: mailboxId,
    ownerId,
    address,
    createdAt: new Date().toISOString(),
    smtp: { host: MAILCOW_SMTP_HOST, port: MAILCOW_SMTP_PORT, security: 'STARTTLS' },
    imap: { host: MAILCOW_IMAP_HOST, port: MAILCOW_IMAP_PORT, security: 'TLS' },
    mailProvider: 'mailcow',
    mailcowPasswordEncrypted: encryptSecret(mailcowPassword),
    forwardTo: forwardTo || null,
    inboundCaptureEnabled: true,
    inboundNote: 'Inbound mail is fetched from this mailbox\'s real IMAP account and shown in this dashboard.',
    webmailPasswordHash
  };
  await db.mailboxes.insert(record);

  return {
    ...record,
    mailcowPasswordEncrypted: undefined,
    webmailPassword,
    webmailPasswordNote: 'Save this now - it will not be shown again. This is the password for this mailbox\'s OWN webmail login (a separate login from your Altegic account) - give it to whoever owns this address. Use the reset endpoint to issue a new one later.'
  };
}

/**
 * Sends mail via SMTP using the MAILBOX'S OWN Mailcow credentials — each
 * mailbox authenticates as itself, matching how a real mail account
 * actually sends, rather than one shared account sending on everyone's
 * behalf.
 */
async function sendMailAs({ from, to, subject, text, mailboxRecord }) {
  if (!mailboxRecord || !mailboxRecord.mailcowPasswordEncrypted) {
    return { ok: false, status: 500, error: 'This mailbox has no stored Mailcow credentials to send with.' };
  }

  let password;
  try {
    password = decryptSecret(mailboxRecord.mailcowPasswordEncrypted);
  } catch (err) {
    return { ok: false, status: 500, error: err.message };
  }

  const transporter = nodemailer.createTransport({
    host: MAILCOW_SMTP_HOST,
    port: MAILCOW_SMTP_PORT,
    secure: false, // STARTTLS on 587, not implicit TLS
    requireTLS: true,
    auth: { user: from, pass: password }
  });

  try {
    const info = await transporter.sendMail({ from, to, subject, text });
    return { ok: true, mailcowMessageId: info.messageId || null };
  } catch (err) {
    return { ok: false, status: 502, error: err.message || 'Mailcow SMTP send failed' };
  }
}

/**
 * Pulls new messages from this mailbox's real IMAP INBOX since the given
 * date, returning them in a shape close enough to what the existing
 * webmail message list already expects. This is a PULL model (call it
 * when the webmail inbox is opened/refreshed) rather than Mailgun's PUSH
 * webhook model — Mailcow has no equivalent built-in inbound webhook, and
 * building one would mean piping Postfix delivery through a custom
 * script on the mail server itself, real additional server-side work
 * beyond this app. Polling on inbox-open is simpler, needs no extra
 * moving parts on the mail server, and is a reasonable trade-off for a
 * first version — a mailbox owner sees new mail when they open their
 * inbox, not the instant it arrives.
 */
async function fetchNewMessages({ mailboxRecord, sinceDate }) {
  if (!mailboxRecord || !mailboxRecord.mailcowPasswordEncrypted) {
    const err = new Error('This mailbox has no stored Mailcow credentials to fetch with.');
    err.status = 500;
    throw err;
  }
  const password = decryptSecret(mailboxRecord.mailcowPasswordEncrypted);

  const client = new ImapFlow({
    host: MAILCOW_IMAP_HOST,
    port: MAILCOW_IMAP_PORT,
    secure: true,
    auth: { user: mailboxRecord.address, pass: password },
    logger: false
  });

  const messages = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const searchCriteria = sinceDate ? { since: new Date(sinceDate) } : { all: true };
      for await (const msg of client.fetch(searchCriteria, { envelope: true, source: true, uid: true })) {
        messages.push({
          uid: msg.uid,
          from: msg.envelope.from?.[0]?.address || 'unknown',
          to: msg.envelope.to?.[0]?.address || mailboxRecord.address,
          subject: msg.envelope.subject || '(no subject)',
          date: msg.envelope.date ? msg.envelope.date.toISOString() : new Date().toISOString(),
          bodyText: msg.source ? msg.source.toString('utf8') : ''
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
  return messages;
}

module.exports = { isMailcowConfigured, createMailboxForAccount, sendMailAs, fetchNewMessages, MAILCOW_DOMAIN };
