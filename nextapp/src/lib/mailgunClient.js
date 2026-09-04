const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

// ---------------------------------------------------------------------------
// Ported from server/mailgunClient.js. Extends the earlier partial version
// (config-check functions only, built for the health endpoint) with the
// full mailbox creation and send logic, now that mailboxes is being built.
// No Express-specific code anywhere in this file, so - consistent with
// every other service ported in this migration - it's a near-verbatim
// copy, with node-fetch dropped for Node 22's native global fetch.
// ---------------------------------------------------------------------------

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_BASE_URL = process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net/v3';
const MAILGUN_WEBHOOK_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;

function isMailgunConfigured() {
  return Boolean(
    MAILGUN_API_KEY &&
    MAILGUN_API_KEY !== 'key-xxxxxxxxxxxxxxxxxxxxxxxx' &&
    MAILGUN_DOMAIN &&
    MAILGUN_DOMAIN !== 'mail.yourbrand.com'
  );
}

function isInboundCaptureConfigured() {
  return Boolean(
    PUBLIC_BASE_URL &&
    MAILGUN_WEBHOOK_SIGNING_KEY &&
    MAILGUN_WEBHOOK_SIGNING_KEY !== 'your_webhook_signing_key_here'
  );
}

function authHeader() {
  const token = Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64');
  return `Basic ${token}`;
}

async function sendMailAs({ from, to, subject, text }) {
  try {
    const params = new URLSearchParams();
    params.append('from', from);
    params.append('to', to);
    params.append('subject', subject);
    params.append('text', text);

    const response = await fetch(`${MAILGUN_BASE_URL}/${MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const rawBody = await response.text();
    let data;
    try {
      data = JSON.parse(rawBody);
    } catch {
      return {
        ok: false,
        status: response.status || 502,
        error: 'Mailgun did not return a valid response when sending. Check MAILGUN_DOMAIN and MAILGUN_BASE_URL in .env.'
      };
    }
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.message || 'Mailgun error' };
    }
    return { ok: true, mailgunMessageId: data.id || null };
  } catch (err) {
    return { ok: false, status: 500, error: err.message };
  }
}

function verifyWebhookSignature({ timestamp, token, signature }) {
  if (!MAILGUN_WEBHOOK_SIGNING_KEY || !timestamp || !token || !signature) return false;

  const expected = crypto
    .createHmac('sha256', MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(`${timestamp}${token}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(String(signature), 'hex');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

async function createMailboxForAccount(ownerId, localPart, forwardTo) {
  const address = `${localPart}@${MAILGUN_DOMAIN}`;

  const dup = db.mailboxes.find((m) => m.ownerId === ownerId && m.address === address);
  if (dup) {
    const err = new Error(`${address} already exists on this account`);
    err.status = 409;
    throw err;
  }

  const mailboxId = crypto.randomUUID();
  const inboundCaptureEnabled = isInboundCaptureConfigured();

  const params = new URLSearchParams();
  params.append('priority', '0');
  params.append('description', `Route for ${address}`);
  params.append('expression', `match_recipient("${address}")`);

  if (inboundCaptureEnabled) {
    const webhookUrl = `${PUBLIC_BASE_URL}/api/webhooks/mailgun/inbound?mailboxId=${mailboxId}`;
    params.append('action', `forward("${webhookUrl}")`);
    if (forwardTo) params.append('action', `forward("${forwardTo}")`);
  } else {
    params.append('action', `forward("${forwardTo || address}")`);
  }
  params.append('action', 'stop()');

  const response = await fetch(`${MAILGUN_BASE_URL}/routes`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  const rawBody = await response.text();
  let data;
  try {
    data = JSON.parse(rawBody);
  } catch {
    const err = new Error('Mailgun did not return a valid response. Check MAILGUN_DOMAIN and MAILGUN_BASE_URL in .env.');
    err.status = response.status || 502;
    throw err;
  }
  if (!response.ok) {
    const err = new Error(data.message || 'Mailgun error');
    err.status = response.status;
    err.data = data;
    throw err;
  }

  const webmailPassword = crypto.randomBytes(9).toString('base64url');
  const webmailPasswordHash = await bcrypt.hash(webmailPassword, 10);

  const record = {
    id: mailboxId,
    ownerId,
    address,
    createdAt: new Date().toISOString(),
    smtp: { host: `smtp.${MAILGUN_DOMAIN}`, port: 587, security: 'STARTTLS' },
    imapNote: 'Mailgun has no native IMAP - pair with a mail store (Dovecot) or an IMAP-capable provider for real Outlook login.',
    mailgunRouteId: data.route ? data.route.id : null,
    inboundCaptureEnabled,
    inboundNote: inboundCaptureEnabled
      ? 'Inbound mail is captured and shown in this dashboard (GET /api/mailboxes/:id/messages).'
      : 'PUBLIC_BASE_URL / MAILGUN_WEBHOOK_SIGNING_KEY are not set, so inbound mail only plain-forwards and will not appear in this dashboard.',
    webmailPasswordHash
  };
  await db.mailboxes.insert(record);

  return {
    ...record,
    webmailPassword,
    webmailPasswordNote: 'Save this now - it will not be shown again. This is the password for this mailbox\'s OWN webmail login (a separate login from your Altegic account) - give it to whoever owns this address. Use the reset endpoint to issue a new one later.'
  };
}

module.exports = {
  MAILGUN_API_KEY,
  MAILGUN_DOMAIN,
  MAILGUN_BASE_URL,
  PUBLIC_BASE_URL,
  isMailgunConfigured,
  isInboundCaptureConfigured,
  authHeader,
  verifyWebhookSignature,
  sendMailAs,
  createMailboxForAccount
};
