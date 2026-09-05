import { NextResponse } from 'next/server';

const { requireMailboxAuth } = require('@/lib/mailboxAuth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/webmail/me
 */
async function GET_impl(request) {
  let mailbox;
  try {
    mailbox = requireMailboxAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  return NextResponse.json({ address: mailbox.address });
}
export const GET = withSanitizedErrors(GET_impl);
