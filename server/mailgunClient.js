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
  verifyWebhookSignature
};
