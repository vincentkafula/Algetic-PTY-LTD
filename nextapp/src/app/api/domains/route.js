import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/domains
 * List domains this account has registered through Altegic.
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const domains = db.domains.filter((d) => d.ownerId === user.id);
  return NextResponse.json({ domains });
}
export const GET = withSanitizedErrors(GET_impl);
