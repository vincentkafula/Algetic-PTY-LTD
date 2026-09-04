// ---------------------------------------------------------------------------
// PARTIAL port of server/mailgunClient.js — only the configuration-check
// functions and constants needed for the health check endpoint and the
// dashboard shell. The full mailbox creation logic
// (createMailboxForAccount) is intentionally NOT ported here yet — that
// piece is blocked on a still-pending business decision
// (MAILBOX_MONTHLY_PRICE_USD_CENTS), same as it was in the Express
// migration. This file will be extended with that logic once mailboxes
// is built.
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

module.exports = {
  MAILGUN_API_KEY,
  MAILGUN_DOMAIN,
  MAILGUN_BASE_URL,
  PUBLIC_BASE_URL,
  isMailgunConfigured,
  isInboundCaptureConfigured
};
