import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { MAILGUN_BASE_URL, isMailgunConfigured, authHeader } = require('@/lib/mailgunClient');

/**
 * DELETE /api/mailboxes/:id
 * Removes the Mailgun route (if configured) and the local record, along
 * with that mailbox's captured message history.
 */
export async function DELETE(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const record = db.mailboxes.find((m) => m.id === id && m.ownerId === user.id);
  if (!record) return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });

  try {
    if (isMailgunConfigured() && record.mailgunRouteId) {
      await fetch(`${MAILGUN_BASE_URL}/routes/${record.mailgunRouteId}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader() }
      });
    }
  } catch (err) {
    console.error('Failed to delete Mailgun route:', err.message);
  }

  await db.mailboxes.remove((m) => m.id === record.id);
  await db.messages.remove((msg) => msg.mailboxId === record.id);
  return new NextResponse(null, { status: 204 });
}
