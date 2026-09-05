import { NextResponse } from 'next/server';

const crypto = require('crypto');
const db = require('@/lib/db');
const { requireMailboxAuth } = require('@/lib/mailboxAuth');
const { isMailgunConfigured, sendMailAs } = require('@/lib/mailgunClient');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * POST /api/webmail/send
 * body: { to, subject, text }
 */
async function POST_impl(request) {
  let mailbox;
  try {
    mailbox = requireMailboxAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { to, subject, text } = body || {};
  if (!to || !subject || !text) {
    return NextResponse.json({ error: 'to, subject, and text are all required' }, { status: 400 });
  }
  if (!isMailgunConfigured()) {
    return NextResponse.json({ error: 'Mail sending is not configured on this server yet' }, { status: 500 });
  }

  const result = await sendMailAs({ from: mailbox.address, to, subject, text });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const record = {
    id: crypto.randomUUID(),
    ownerId: mailbox.ownerId,
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
  return NextResponse.json(record, { status: 201 });
}
export const POST = withSanitizedErrors(POST_impl);
