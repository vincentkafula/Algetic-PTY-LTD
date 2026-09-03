const crypto = require('crypto');

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

module.exports = {
  MAILGUN_API_KEY,
  MAILGUN_DOMAIN,
  MAILGUN_BASE_URL,
  PUBLIC_BASE_URL,
  isMailgunConfigured,
  isInboundCaptureConfigured,
  authHeader,
  verifyWebhookSignature,
  sendMailAs
};
