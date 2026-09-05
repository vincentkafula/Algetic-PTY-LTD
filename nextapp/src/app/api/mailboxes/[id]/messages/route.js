import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/mailboxes/:id/messages
 * Lists inbound and outbound message history captured for this mailbox,
 * most recent first.
 */
async function GET_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const mailbox = db.mailboxes.find((m) => m.id === id && m.ownerId === user.id);
  if (!mailbox) return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });

  const messages = db.messages
    .filter((msg) => msg.mailboxId === mailbox.id && msg.ownerId === user.id)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return NextResponse.json({ messages });
}
export const GET = withSanitizedErrors(GET_impl);
