import { NextResponse } from 'next/server';

const { requireMailboxAuth } = require('@/lib/mailboxAuth');

/**
 * GET /api/webmail/me
 */
export async function GET(request) {
  let mailbox;
  try {
    mailbox = requireMailboxAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  return NextResponse.json({ address: mailbox.address });
}
