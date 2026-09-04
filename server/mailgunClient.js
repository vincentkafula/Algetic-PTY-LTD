const crypto = require('crypto');
const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');
const db = require('./db');

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

/**
 * Sends an email via the Mailgun Messages API. Shared between the
 * account-scoped mailbox send route (routes/mailboxes.js) and the
 * mailbox-scoped webmail send route (routes/webmail.js) — same operation,
 * two different callers with two different auth models.
 *
 * Returns { ok: true, mailgunMessageId } on success, or
 * { ok: false, status, error } on failure — never throws, so callers
 * don't need their own try/catch just to turn a rejection into a response.
 */
async function sendMailAs({ from, to, subject, text }) {
  const fetch = require('node-fetch');
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

/**
 * Verifies Mailgun's inbound-route webhook signature: HMAC-SHA256 over
 * timestamp+token, keyed with the HTTP webhook signing key (Settings ->
 * API Keys -> HTTP webhook signing key in the Mailgun dashboard). This is
 * a DIFFERENT key from MAILGUN_API_KEY — Mailgun made that split so a
 * leaked sending key can't be used to forge inbound webhook calls.
 */
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

/**
 * Actually creates the mailbox (Mailgun route + local record + webmail
 * credential) — the real provisioning work, extracted so both the
 * direct-creation path and routes/paymentWebhooks.js's payment-gated
 * path can share it without duplicating logic. Throws on failure;
 * callers decide how to translate that into an HTTP response or an
 * order status update.
 *
 * Re-checks for a duplicate address here too, not just at order-creation
 * time in routes/mailboxes.js — an unlikely but real race (two orders
 * for the same localPart, one completing payment while the other is
 * still pending) could otherwise slip through.
 */
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
      : 'PUBLIC_BASE_URL / MAILGUN_WEBHOOK_SIGNING_KEY are not set, so inbound mail only plain-forwards and will not appear in this dashboard — see server/.env.example.',
    webmailPasswordHash
  };
  await db.mailboxes.insert(record);

  return {
    ...record,
    webmailPassword,
    webmailPasswordNote: 'Save this now — it will not be shown again. This is the password for this mailbox\'s OWN webmail login (a separate login from your Altegic account) — give it to whoever owns this address. Use the reset endpoint to issue a new one later.'
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
