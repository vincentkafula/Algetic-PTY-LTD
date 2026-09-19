// ---------------------------------------------------------------------------
// Single switch point between mailgunClient.js (the reseller model Altegic
// uses today) and mailcowClient.js (self-hosted, once a real Mailcow
// instance exists — see the setup guide). Every route that sends mail or
// creates a mailbox should require THIS file, not either client directly,
// so switching providers is a one-line env var change, not a code change
// across every caller.
//
// EMAIL_PROVIDER=mailcow switches to self-hosted Mailcow. Anything else
// (including unset) keeps the current Mailgun behavior — the safe default,
// since Mailcow being unconfigured should never silently break the
// existing, working Mailgun flow.
// ---------------------------------------------------------------------------

const mailgun = require('./mailgunClient');
const mailcow = require('./mailcowClient');

function activeProvider() {
  return process.env.EMAIL_PROVIDER === 'mailcow' ? 'mailcow' : 'mailgun';
}

function isEmailConfigured() {
  return activeProvider() === 'mailcow' ? mailcow.isMailcowConfigured() : mailgun.isMailgunConfigured();
}

async function createMailboxForAccount(ownerId, localPart, forwardTo) {
  if (activeProvider() === 'mailcow') {
    return mailcow.createMailboxForAccount(ownerId, localPart, forwardTo);
  }
  return mailgun.createMailboxForAccount(ownerId, localPart, forwardTo);
}

/**
 * mailboxRecord (the full stored mailbox, e.g. from db.mailboxes.find)
 * is required for Mailcow (it authenticates SMTP as that specific
 * mailbox) and simply ignored by Mailgun (which sends via one shared
 * API key regardless of which mailbox is "from"). Callers should always
 * pass it when available rather than only passing it for one provider.
 */
async function sendMailAs({ from, to, subject, text, mailboxRecord }) {
  if (activeProvider() === 'mailcow') {
    return mailcow.sendMailAs({ from, to, subject, text, mailboxRecord });
  }
  return mailgun.sendMailAs({ from, to, subject, text });
}

/**
 * Only meaningful for Mailcow (Mailgun's inbound flow is push-webhook
 * based, handled entirely by webhooks/mailgun/inbound/route.js, not a
 * pull function like this). Returns [] under Mailgun rather than
 * throwing, so a caller can call this unconditionally without an
 * extra "which provider" branch of its own.
 */
async function fetchNewMessages({ mailboxRecord, sinceDate }) {
  if (activeProvider() === 'mailcow') {
    return mailcow.fetchNewMessages({ mailboxRecord, sinceDate });
  }
  return [];
}

module.exports = { activeProvider, isEmailConfigured, createMailboxForAccount, sendMailAs, fetchNewMessages };
