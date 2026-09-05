import { NextResponse } from 'next/server';

const bcrypt = require('bcryptjs');
const db = require('@/lib/db');
const { issueMailboxToken } = require('@/lib/mailboxAuth');

/**
 * POST /api/webmail/login
 * body: { email, password }
 * Public — this IS the login endpoint. Deliberately returns the same
 * generic error whether the address doesn't exist or the password is
 * wrong, so this can't be used to enumerate which addresses exist on
 * the platform.
 */
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { email, password } = body || {};
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const mailbox = db.mailboxes.find((m) => m.address.toLowerCase() === String(email).toLowerCase());
  if (!mailbox || !mailbox.webmailPasswordHash) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, mailbox.webmailPasswordHash);
  if (!ok) return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });

  return NextResponse.json({ token: issueMailboxToken(mailbox), address: mailbox.address });
}
