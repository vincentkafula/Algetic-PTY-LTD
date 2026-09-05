import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireMailboxAuth } = require('@/lib/mailboxAuth');
const { VALID_FOLDERS, effectiveFolder } = require('@/lib/webmailFolders');

/**
 * GET /api/webmail/messages/:id
 */
export async function GET(request, { params }) {
  let mailbox;
  try {
    mailbox = requireMailboxAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const msg = db.messages.find((m) => m.id === id && m.mailboxId === mailbox.id);
  if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  return NextResponse.json({ ...msg, folder: effectiveFolder(msg) });
}

/**
 * PATCH /api/webmail/messages/:id
 * body: { folder?, starred? }
 * Moves a message between folders and/or toggles its star — this is how
 * Spam and Trash actually get populated (a person clicking a button),
 * not automated filtering.
 */
export async function PATCH(request, { params }) {
  let mailbox;
  try {
    mailbox = requireMailboxAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const msg = db.messages.find((m) => m.id === id && m.mailboxId === mailbox.id);
  if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { folder, starred } = body || {};
  const updates = {};
  if (folder !== undefined) {
    if (!VALID_FOLDERS.includes(folder)) {
      return NextResponse.json({ error: `folder must be one of: ${VALID_FOLDERS.join(', ')}` }, { status: 400 });
    }
    updates.folder = folder;
  }
  if (starred !== undefined) {
    if (typeof starred !== 'boolean') return NextResponse.json({ error: 'starred must be true or false' }, { status: 400 });
    updates.starred = starred;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Provide folder and/or starred to update' }, { status: 400 });
  }

  const updated = await db.messages.update((m) => m.id === msg.id, updates);
  return NextResponse.json({ ...updated, folder: effectiveFolder(updated) });
}

/**
 * DELETE /api/webmail/messages/:id
 * Permanent delete — intended for use from Trash, but a direct delete
 * from any folder is allowed too via the API.
 */
export async function DELETE(request, { params }) {
  let mailbox;
  try {
    mailbox = requireMailboxAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const msg = db.messages.find((m) => m.id === id && m.mailboxId === mailbox.id);
  if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  await db.messages.remove((m) => m.id === msg.id);
  return new NextResponse(null, { status: 204 });
}
