import { NextResponse } from 'next/server';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * POST /api/mailboxes/:id/webmail-password/reset
 * Regenerates this mailbox's OWN webmail login password (a separate
 * credential from the Altegic account). Returns the new password once —
 * there is no way to retrieve the old one, by design.
 */
async function POST_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const mailbox = db.mailboxes.find((m) => m.id === id && m.ownerId === user.id);
  if (!mailbox) return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });

  const webmailPassword = crypto.randomBytes(9).toString('base64url');
  const webmailPasswordHash = await bcrypt.hash(webmailPassword, 10);
  await db.mailboxes.update((m) => m.id === mailbox.id, { webmailPasswordHash });

  return NextResponse.json({
    address: mailbox.address,
    webmailPassword,
    webmailPasswordNote: 'Save this now — it will not be shown again.'
  });
}
export const POST = withSanitizedErrors(POST_impl);
