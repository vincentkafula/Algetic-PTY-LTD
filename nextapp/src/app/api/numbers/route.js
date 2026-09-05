import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/numbers
 * List numbers provisioned by the logged-in account.
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const provisioned = db.numbers.filter((n) => n.ownerId === user.id);
  return NextResponse.json({ provisioned });
}
export const GET = withSanitizedErrors(GET_impl);
