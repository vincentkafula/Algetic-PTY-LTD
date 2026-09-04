import { NextResponse } from 'next/server';

const crypto = require('crypto');
const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { isMailgunConfigured, sendMailAs } = require('@/lib/mailgunClient');

/**
 * POST /api/mailboxes/:id/send
 * body: { to, subject, text }
 */
export async function POST(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const mailbox = db.mailboxes.find((m) => m.id === id && m.ownerId === user.id);
  if (!mailbox) return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { to, subject, text } = body || {};
  if (!to || !subject || !text) {
    return NextResponse.json({ error: 'to, subject, and text are all required' }, { status: 400 });
  }
  if (!isMailgunConfigured()) {
    return NextResponse.json({ error: 'Server is missing MAILGUN_API_KEY / MAILGUN_DOMAIN in .env' }, { status: 500 });
  }

  try {
    const result = await sendMailAs({ from: mailbox.address, to, subject, text });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const record = {
      id: crypto.randomUUID(),
      ownerId: user.id,
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
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
