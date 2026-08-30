const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const router = express.Router();

const db = require('../db');
const { verifyWebhookSignature, isInboundCaptureConfigured } = require('../mailgunClient');

// Mailgun posts inbound mail as multipart/form-data (it may include
// attachments as file parts) — this app doesn't store attachment content,
// so we accept and discard file parts and only keep the text fields.
const upload = multer({ storage: multer.memoryStorage() });

// Cap stored body length so a single large email can't blow up the JSON
// file store this starter uses. Swap for a real database before handling
// meaningful mail volume — see README.
const MAX_BODY_CHARS = 5000;

/**
 * POST /api/webhooks/mailgun/inbound?mailboxId=<id>
 *
 * NOT behind requireAuth — Mailgun calls this directly, it has no user
 * session. Authenticity instead comes from verifying Mailgun's own
 * signature (timestamp/token/signature fields) against
 * MAILGUN_WEBHOOK_SIGNING_KEY. A request that fails verification is
 * rejected before anything is written to storage.
 */
router.post('/mailgun/inbound', upload.any(), async (req, res) => {
  if (!isInboundCaptureConfigured()) {
    // Inbound capture isn't set up on this deployment at all — nothing
    // should be pointing at this URL, so there's nothing more to do than
    // acknowledge and drop it.
    return res.status(503).json({ error: 'Inbound capture is not configured on this server' });
  }

  const { mailboxId } = req.query;
  if (!mailboxId) return res.status(400).json({ error: 'mailboxId query param is required' });

  const { timestamp, token, signature } = req.body || {};
  if (!verifyWebhookSignature({ timestamp, token, signature })) {
    return res.status(401).json({ error: 'Invalid Mailgun signature' });
  }

  const mailbox = db.mailboxes.find((m) => m.id === mailboxId);
  if (!mailbox) {
    // The mailbox was deleted after the route was set up but before this
    // message arrived. Acknowledge so Mailgun doesn't retry forever.
    return res.status(200).json({ ok: true, note: 'mailbox no longer exists' });
  }

  const body = req.body || {};
  const bodyText = (body['stripped-text'] || body['body-plain'] || '').slice(0, MAX_BODY_CHARS);

  const record = {
    id: crypto.randomUUID(),
    ownerId: mailbox.ownerId,
    mailboxId: mailbox.id,
    direction: 'inbound',
    from: body.from || body.sender || 'unknown',
    to: body.recipient || mailbox.address,
    subject: body.subject || '(no subject)',
    bodyText,
    mailgunMessageId: body['Message-Id'] || body['message-id'] || null,
    at: new Date().toISOString()
  };
  await db.messages.insert(record);

  res.status(200).json({ ok: true });
});

module.exports = router;
