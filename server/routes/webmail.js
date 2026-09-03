const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();

const db = require('../db');
const { issueMailboxToken, requireMailboxAuth } = require('../middleware/mailboxAuth');
const { isMailgunConfigured, sendMailAs } = require('../mailgunClient');

// ---------------------------------------------------------------------------
// The actual webmail product: a mailbox owner (the end customer who bought
// sales@theirdomain.com, not the Altegic reseller who provisioned it) logs
// in here directly and reads/sends their own mail. Every route below uses
// requireMailboxAuth, NOT the account-level requireAuth — see
// middleware/mailboxAuth.js for why these are kept as two separate systems.
//
// FOLDERS: Inbox, Sent, Spam, Trash are all real, user-driven states on a
// message record (`folder` field) — moving something to Spam or Trash is a
// person clicking a button, not automated spam detection. There is no
// content-based spam filtering in this codebase; anything that lands in
// Spam got there because a mailbox owner put it there. Starred is a
// separate boolean flag, independent of folder, matching how Gmail's star
// works (a starred message still lives in whatever folder it's actually in).
// ---------------------------------------------------------------------------

const VALID_FOLDERS = ['inbox', 'sent', 'spam', 'trash'];

function effectiveFolder(msg) {
  // Legacy records (created before this feature existed) have no folder
  // field — fall back to a reasonable default based on direction so old
  // messages still show up somewhere sensible instead of vanishing.
  return msg.folder || (msg.direction === 'inbound' ? 'inbox' : 'sent');
}

/**
 * POST /api/webmail/login
 * body: { email, password }
 * Public — this IS the login endpoint, there's nothing to be authenticated
 * as yet. Deliberately returns the same generic error whether the address
 * doesn't exist or the password is wrong, so this can't be used to
 * enumerate which addresses exist on the platform.
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const mailbox = db.mailboxes.find((m) => m.address.toLowerCase() === String(email).toLowerCase());
  if (!mailbox || !mailbox.webmailPasswordHash) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  const ok = await bcrypt.compare(password, mailbox.webmailPasswordHash);
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password' });

  res.json({ token: issueMailboxToken(mailbox), address: mailbox.address });
});

router.use(requireMailboxAuth);

/**
 * GET /api/webmail/me
 */
router.get('/me', (req, res) => {
  res.json({ address: req.mailbox.address });
});

/**
 * GET /api/webmail/messages?folder=inbox
 * folder is one of inbox|sent|spam|trash|starred. "starred" is virtual —
 * it shows every starred message regardless of which folder it's actually
 * filed in, same as Gmail.
 */
router.get('/messages', (req, res) => {
  const folder = req.query.folder || 'inbox';
  const all = db.messages.filter((m) => m.mailboxId === req.mailbox.id);

  let filtered;
  if (folder === 'starred') {
    filtered = all.filter((m) => m.starred);
  } else if (VALID_FOLDERS.includes(folder)) {
    filtered = all.filter((m) => effectiveFolder(m) === folder);
  } else {
    return res.status(400).json({ error: `folder must be one of: ${VALID_FOLDERS.join(', ')}, starred` });
  }

  filtered.sort((a, b) => new Date(b.at) - new Date(a.at));
  res.json({
    messages: filtered.map((m) => ({ ...m, folder: effectiveFolder(m) }))
  });
});

/**
 * GET /api/webmail/messages/:id
 */
router.get('/messages/:id', (req, res) => {
  const msg = db.messages.find((m) => m.id === req.params.id && m.mailboxId === req.mailbox.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  res.json({ ...msg, folder: effectiveFolder(msg) });
});

/**
 * POST /api/webmail/send
 * body: { to, subject, text }
 */
router.post('/send', async (req, res) => {
  const { to, subject, text } = req.body || {};
  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'to, subject, and text are all required' });
  }
  if (!isMailgunConfigured()) {
    return res.status(500).json({ error: 'Mail sending is not configured on this server yet' });
  }

  const result = await sendMailAs({ from: req.mailbox.address, to, subject, text });
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  const record = {
    id: crypto.randomUUID(),
    ownerId: req.mailbox.ownerId,
    mailboxId: req.mailbox.id,
    direction: 'outbound',
    folder: 'sent',
    starred: false,
    from: req.mailbox.address,
    to,
    subject,
    bodyText: text.slice(0, 5000),
    mailgunMessageId: result.mailgunMessageId,
    at: new Date().toISOString()
  };
  await db.messages.insert(record);
  res.status(201).json(record);
});

/**
 * PATCH /api/webmail/messages/:id
 * body: { folder?, starred? }
 * Moves a message between folders and/or toggles its star — this is how
 * Spam and Trash actually get populated (a person clicking a button), not
 * automated filtering.
 */
router.patch('/messages/:id', async (req, res) => {
  const msg = db.messages.find((m) => m.id === req.params.id && m.mailboxId === req.mailbox.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  const { folder, starred } = req.body || {};
  const updates = {};
  if (folder !== undefined) {
    if (!VALID_FOLDERS.includes(folder)) {
      return res.status(400).json({ error: `folder must be one of: ${VALID_FOLDERS.join(', ')}` });
    }
    updates.folder = folder;
  }
  if (starred !== undefined) {
    if (typeof starred !== 'boolean') return res.status(400).json({ error: 'starred must be true or false' });
    updates.starred = starred;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Provide folder and/or starred to update' });
  }

  const updated = await db.messages.update((m) => m.id === msg.id, updates);
  res.json({ ...updated, folder: effectiveFolder(updated) });
});

/**
 * DELETE /api/webmail/messages/:id
 * Permanent delete — intended for use from Trash. Deleting from Inbox
 * directly is allowed too (the frontend just doesn't expose that button),
 * matching how most webmail clients let a direct delete skip the trash
 * step via the API even if the UI nudges toward "move to trash" first.
 */
router.delete('/messages/:id', async (req, res) => {
  const msg = db.messages.find((m) => m.id === req.params.id && m.mailboxId === req.mailbox.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  await db.messages.remove((m) => m.id === msg.id);
  res.status(204).end();
});

module.exports = router;
