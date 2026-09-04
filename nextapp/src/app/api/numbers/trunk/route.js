import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const trunking = require('@/lib/services/trunking');

/**
 * GET /api/numbers/trunk
 * Returns the account's SIP trunk info (never the password). 404 if no
 * number has been provisioned yet, since a trunk is created lazily on
 * first provision.
 */
export async function GET(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const record = db.trunks.find((t) => t.ownerId === user.id);
  if (!record) return NextResponse.json({ error: 'No trunk yet — provision a number first' }, { status: 404 });
  return NextResponse.json({ trunk: trunking.publicTrunk(record) });
}
