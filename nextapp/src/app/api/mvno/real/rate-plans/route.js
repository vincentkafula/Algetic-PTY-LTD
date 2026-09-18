import { NextResponse } from 'next/server';

const crypto = require('crypto');
const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

// ---------------------------------------------------------------------------
// REAL, PERSISTENT rate plan records — not simulated demo data. Deliberately
// namespaced under /api/mvno/real/ (distinct from /api/mvno/plans, the
// demo catalog) so there is no ambiguity in the URL itself about which is
// which. This lets an account define the ACTUAL plans it intends to offer
// once real network access is in place via an MVNE/MNO wholesale
// relationship (see /api/mvno/subscribers,* comments) — a real BSS/OSS
// rate-plan catalog is a genuine cost bucket in every MVNO launch (commonly
// $20k-$100k to license/build one), so an account bringing its own reduces
// what a future MVNE integration needs to cover.
// ---------------------------------------------------------------------------

/**
 * GET /api/mvno/real/rate-plans
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  const plans = db.mvnoRatePlans.filter((p) => p.ownerId === user.id);
  return NextResponse.json({ plans });
}
export const GET = withSanitizedErrors(GET_impl);

/**
 * POST /api/mvno/real/rate-plans
 * body: { name, type: "prepaid"|"postpaid", dataGB, voiceMinutes, smsCount, priceZAR }
 * dataGB/voiceMinutes can be null for unlimited.
 */
async function POST_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, type, dataGB, voiceMinutes, smsCount, priceZAR } = body || {};
  if (!name || !type) return NextResponse.json({ error: 'name and type are required' }, { status: 400 });
  if (!['prepaid', 'postpaid'].includes(type)) {
    return NextResponse.json({ error: 'type must be "prepaid" or "postpaid"' }, { status: 400 });
  }
  if (typeof priceZAR !== 'number' || priceZAR < 0) {
    return NextResponse.json({ error: 'priceZAR must be a number 0 or greater' }, { status: 400 });
  }

  const record = {
    id: crypto.randomUUID(),
    ownerId: user.id,
    name,
    type,
    dataGB: dataGB === undefined ? null : dataGB,
    voiceMinutes: voiceMinutes === undefined ? null : voiceMinutes,
    smsCount: smsCount === undefined ? null : smsCount,
    priceZAR,
    active: true,
    createdAt: new Date().toISOString()
  };
  await db.mvnoRatePlans.insert(record);
  return NextResponse.json(record, { status: 201 });
}
export const POST = withSanitizedErrors(POST_impl);
