const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const router = express.Router();

const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const {
  MAILGUN_DOMAIN,
  MAILGUN_BASE_URL,
  PUBLIC_BASE_URL,
  isMailgunConfigured,
  isInboundCaptureConfigured,
  authHeader,
  sendMailAs
} = require('../mailgunClient');

// Every route below requires a logged-in account; mailboxes are always
// scoped to req.user.id so one customer never sees another's data.
router.use(requireAuth);

/**
 * GET /api/mailboxes
 * List mailboxes belonging to the logged-in account.
 */
router.get('/', (req, res) => {
  const mailboxes = db.mailboxes.filter((m) => m.ownerId === req.user.id);
  res.json({ mailboxes });
});

/**
 * POST /api/mailboxes
 * body: { localPart: "sales", forwardTo: "..." }
 * Creates sales@MAILGUN_DOMAIN.
 *
 * Inbound mail handling depends on whether PUBLIC_BASE_URL and
 * MAILGUN_WEBHOOK_SIGNING_KEY are set (see server/.env.example):
 * - If configured: Mailgun forwards inbound mail to this app's own
 *   webhook (routes/webhooks.js), which stores it so it shows up in the
 *   dashboard and via GET /api/mailboxes/:id/messages. If forwardTo is
 *   also given, mail is additionally forwarded there as a backup copy.
 * - If not configured: falls back to plain forwarding only (forwardTo, or
 *   the mailbox address itself) — the old behavior. inboundCaptureEnabled
 *   on the returned record tells you which mode a mailbox is in.
 *
 * This still isn't a real IMAP mailbox — see README for why Mailgun alone
 * can't offer that, and what "type your password into Outlook" actually
 * requires.
 */
router.post('/', async (req, res) => {
  const { localPart, forwardTo } = req.body || {};
  if (!localPart) {
    return res.status(400).json({ error: 'localPart is required, e.g. "sales"' });
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(localPart)) {
    return res.status(400).json({ error: 'localPart can only contain letters, numbers, dots, dashes and underscores' });
  }
  if (!isMailgunConfigured()) {
    return res.status(500).json({ error: 'Server is missing MAILGUN_API_KEY / MAILGUN_DOMAIN in .env' });
  }

  const address = `${localPart}@${MAILGUN_DOMAIN}`;

  const dup = db.mailboxes.find((m) => m.ownerId === req.user.id && m.address === address);
  if (dup) return res.status(409).json({ error: `${address} already exists on your account` });

  // Generated up front so it can be embedded in the webhook callback URL
  // Mailgun will POST inbound mail to.
  const mailboxId = crypto.randomUUID();
  const inboundCaptureEnabled = isInboundCaptureConfigured();

  try {
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
      // Mailgun returned something non-JSON (e.g. an HTML error page) -
      // usually a bad domain/key/base URL. Surface a clear message instead
      // of crashing on JSON.parse.
      return res.status(response.status || 502).json({
        error: 'Mailgun did not return a valid response. Check MAILGUN_DOMAIN and MAILGUN_BASE_URL in .env.',
        status: response.status
      });
    }
    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Mailgun error', data });
    }

    // Generates the credential for this mailbox's OWN webmail login — a
    // separate authentication system from the Altegic account that just
    // created it (see middleware/mailboxAuth.js). Shown once, right here;
    // never stored or retrievable in plaintext again, same discipline as
    // every other credential this app issues.
    const webmailPassword = crypto.randomBytes(9).toString('base64url');
    const webmailPasswordHash = await bcrypt.hash(webmailPassword, 10);

    const record = {
      id: mailboxId,
      ownerId: req.user.id,
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
    res.status(201).json({
      ...record,
      webmailPassword,
      webmailPasswordNote: 'Save this now — it will not be shown again. This is the password for this mailbox\'s OWN webmail login (a separate login from your Altegic account) — give it to whoever owns this address. Use the reset endpoint to issue a new one later.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/mailboxes/:id/messages
 * Lists inbound and outbound message history captured for this mailbox,
 * most recent first. Requires inbound capture to be configured for
 * inbound messages to appear at all — sent messages always show up.
 */
router.get('/:id/messages', (req, res) => {
  const mailbox = db.mailboxes.find((m) => m.id === req.params.id && m.ownerId === req.user.id);
  if (!mailbox) return res.status(404).json({ error: 'Mailbox not found' });

  const messages = db.messages
    .filter((msg) => msg.mailboxId === mailbox.id && msg.ownerId === req.user.id)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  res.json({ messages });
});

/**
 * POST /api/mailboxes/:id/send
 * body: { to, subject, text }
 * Sends an email from this mailbox's address via the Mailgun Messages API
 * and records it in this mailbox's message history.
 */
router.post('/:id/send', async (req, res) => {
  const mailbox = db.mailboxes.find((m) => m.id === req.params.id && m.ownerId === req.user.id);
  if (!mailbox) return res.status(404).json({ error: 'Mailbox not found' });

  const { to, subject, text } = req.body || {};
  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'to, subject, and text are all required' });
  }
  if (!isMailgunConfigured()) {
    return res.status(500).json({ error: 'Server is missing MAILGUN_API_KEY / MAILGUN_DOMAIN in .env' });
  }

  try {
    const result = await sendMailAs({ from: mailbox.address, to, subject, text });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const record = {
      id: crypto.randomUUID(),
      ownerId: req.user.id,
      mailboxId: mailbox.id,
      direction: 'outbound',
      folder: 'sent',
      starred: false,
      from: mailbox.address,
      to,
      subject,
      bodyText: text.slice(0, 5000),
      mailgunMessageId: result.mailgunMessageId,
      at: new Date().toISOString()
    };
    await db.messages.insert(record);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/mailboxes/:id/webmail-password/reset
 * Regenerates this mailbox's OWN webmail login password (a separate
 * credential from the Altegic account, see routes/webmail.js). Returns
 * the new password once — there is no way to retrieve the old one, by
 * design, same as every other credential this app issues.
 */
router.post('/:id/webmail-password/reset', async (req, res) => {
  const mailbox = db.mailboxes.find((m) => m.id === req.params.id && m.ownerId === req.user.id);
  if (!mailbox) return res.status(404).json({ error: 'Mailbox not found' });

  const webmailPassword = crypto.randomBytes(9).toString('base64url');
  const webmailPasswordHash = await bcrypt.hash(webmailPassword, 10);
  await db.mailboxes.update((m) => m.id === mailbox.id, { webmailPasswordHash });

  res.json({
    address: mailbox.address,
    webmailPassword,
    webmailPasswordNote: 'Save this now — it will not be shown again.'
  });
});

/**
 * DELETE /api/mailboxes/:id
 * Removes the Mailgun route (if configured) and the local record, along
 * with that mailbox's captured message history.
 * Only the owning account can delete its own mailbox.
 */
router.delete('/:id', async (req, res) => {
  const record = db.mailboxes.find((m) => m.id === req.params.id && m.ownerId === req.user.id);
  if (!record) return res.status(404).json({ error: 'Mailbox not found' });

  try {
    if (isMailgunConfigured() && record.mailgunRouteId) {
      await fetch(`${MAILGUN_BASE_URL}/routes/${record.mailgunRouteId}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader() }
      });
      // Non-fatal if Mailgun-side deletion fails (e.g. already gone) — we
      // still remove the local record so the dashboard stays accurate.
    }
  } catch (err) {
    console.error('Failed to delete Mailgun route:', err.message);
  }

  await db.mailboxes.remove((m) => m.id === record.id);
  await db.messages.remove((msg) => msg.mailboxId === record.id);
  res.status(204).end();
});

module.exports = router;
