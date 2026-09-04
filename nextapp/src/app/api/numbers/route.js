import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');

/**
 * GET /api/numbers
 * List numbers provisioned by the logged-in account.
 */
export async function GET(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const provisioned = db.numbers.filter((n) => n.ownerId === user.id);
  return NextResponse.json({ provisioned });
}
