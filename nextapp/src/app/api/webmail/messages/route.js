import { NextResponse } from 'next/server';

const crypto = require('crypto');
const db = require('@/lib/db');
const { requireMailboxAuth } = require('@/lib/mailboxAuth');
const { VALID_FOLDERS, effectiveFolder } = require('@/lib/webmailFolders');
const { activeProvider, fetchNewMessages } = require('@/lib/emailProvider');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/webmail/messages?folder=inbox
 * folder is one of inbox|sent|spam|trash|starred. "starred" is virtual —
 * it shows every starred message regardless of which folder it's
 * actually filed in, same as Gmail.
 *
 * Under Mailcow (see emailProvider.js), viewing "inbox" first pulls any
 * new messages from the mailbox's real IMAP account and merges them into
 * local storage — the pull-on-open model described in mailcowClient.js's
 * own comments. Sync failures are logged and swallowed rather than
 * failing the whole request: a temporarily-unreachable mail server
 * should never make ALREADY-synced messages disappear from view.
 */
async function GET_impl(request) {
  let mailbox;
  try {
    mailbox = requireMailboxAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const folder = request.nextUrl.searchParams.get('folder') || 'inbox';

  if (folder === 'inbox' && activeProvider() === 'mailcow') {
    try {
      const mailboxRecord = db.mailboxes.find((m) => m.id === mailbox.id);
      const existing = db.messages.filter((m) => m.mailboxId === mailbox.id && m.direction === 'inbound');
      const latest = existing.reduce((max, m) => (new Date(m.at) > new Date(max || 0) ? m.at : max), null);
      const knownUids = new Set(existing.map((m) => m.providerUid).filter((v) => v !== undefined));

      const fetched = await fetchNewMessages({ mailboxRecord, sinceDate: latest });
      for (const msg of fetched) {
        if (knownUids.has(msg.uid)) continue; // already synced on a previous call
        await db.messages.insert({
          id: crypto.randomUUID(),
          ownerId: mailbox.ownerId,
          mailboxId: mailbox.id,
          direction: 'inbound',
          folder: 'inbox',
          starred: false,
          from: msg.from,
          to: msg.to,
          subject: msg.subject,
          bodyText: (msg.bodyText || '').slice(0, 5000),
          providerUid: msg.uid,
          at: msg.date
        });
      }
    } catch (err) {
      console.error('IMAP sync failed for mailbox', mailbox.id, err.message);
    }
  }

  const all = db.messages.filter((m) => m.mailboxId === mailbox.id);

  let filtered;
  if (folder === 'starred') {
    filtered = all.filter((m) => m.starred);
  } else if (VALID_FOLDERS.includes(folder)) {
    filtered = all.filter((m) => effectiveFolder(m) === folder);
  } else {
    return NextResponse.json({ error: `folder must be one of: ${VALID_FOLDERS.join(', ')}, starred` }, { status: 400 });
  }

  filtered.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return NextResponse.json({
    messages: filtered.map((m) => ({ ...m, folder: effectiveFolder(m) }))
  });
}
export const GET = withSanitizedErrors(GET_impl);
