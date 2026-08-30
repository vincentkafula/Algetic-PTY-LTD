const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const router = express.Router();

const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_BASE_URL = process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net/v3';

function authHeader() {
  const token = Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64');
  return `Basic ${token}`;
}

function isMailgunConfigured() {
  return Boolean(
    MAILGUN_API_KEY &&
    MAILGUN_API_KEY !== 'key-xxxxxxxxxxxxxxxxxxxxxxxx' &&
    MAILGUN_DOMAIN &&
    MAILGUN_DOMAIN !== 'mail.yourbrand.com'
  );
}

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
 * Creates sales@MAILGUN_DOMAIN and returns the IMAP/SMTP settings
 * the customer pastes into Outlook.
 *
 * Note: Mailgun is primarily built for transactional/outbound sending and
 * inbound routing (forwarding/webhooks), not native IMAP storage. To give
 * customers a real Outlook-style "mailbox" (IMAP login, folders, persistent
 * storage) you'd pair Mailgun's inbound routing with a mail store like
 * Dovecot, or use a provider that offers IMAP directly (e.g. Migadu,
 * ImprovMX + a store, or Amazon WorkMail). This route shows the Mailgun
 * side (send/receive over HTTP + routing) so you can see the API shape.
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

  try {
    // Create an inbound route: mail to this address gets forwarded/stored.
    const params = new URLSearchParams();
    params.append('priority', '0');
    params.append('description', `Route for ${address}`);
    params.append('expression', `match_recipient("${address}")`);
    params.append('action', `forward("${forwardTo || address}")`);
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

    const record = {
      id: crypto.randomUUID(),
      ownerId: req.user.id,
      address,
      createdAt: new Date().toISOString(),
      smtp: { host: `smtp.${MAILGUN_DOMAIN}`, port: 587, security: 'STARTTLS' },
      imapNote: 'Mailgun has no native IMAP - pair with a mail store (Dovecot) or an IMAP-capable provider for real Outlook login.',
      mailgunRouteId: data.route ? data.route.id : null
    };
    await db.mailboxes.insert(record);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/mailboxes/:id
 * Removes the Mailgun route (if configured) and the local record.
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
  res.status(204).end();
});

module.exports = router;
