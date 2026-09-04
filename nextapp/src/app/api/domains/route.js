import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');

/**
 * GET /api/domains
 * List domains this account has registered through Altegic.
 */
export async function GET(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const domains = db.domains.filter((d) => d.ownerId === user.id);
  return NextResponse.json({ domains });
}
