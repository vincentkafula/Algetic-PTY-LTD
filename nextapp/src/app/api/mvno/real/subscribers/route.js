import { NextResponse } from 'next/server';

const crypto = require('crypto');
const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

// ---------------------------------------------------------------------------
// REAL, PERSISTENT subscriber records — a genuine operations ledger, not
// simulated demo data. This is the actual thing an independent MVNO needs
// to track its own customer base, regardless of which network partner
// eventually provides the underlying connectivity.
//
// RICA (Regulation of Interception of Communications Act) requires every
// SIM registered against verified identity — but this endpoint does NOT
// store a subscriber's full South African ID number. Only the last 4
// digits are kept (idNumberLast4), enough for an operator to reference
// "which real verification record this is" without holding a full
// government ID number in an unencrypted JSON file — a real production
// database with proper encryption-at-rest and access control is a
// prerequisite for holding the full number, same disclaimer as
// everywhere else in this app's data layer (see src/lib/db.js's header).
// Full RICA verification against Home Affairs / an accredited provider is
// a real integration a future MVNE partnership would need to provide —
// ricaVerified here is a manually-set flag an operator toggles once
// they've completed that verification through whatever channel they're
// actually using today, not something this app performs itself.
// ---------------------------------------------------------------------------

/**
 * GET /api/mvno/real/subscribers
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  const subscribers = db.mvnoSubscribers.filter((s) => s.ownerId === user.id);
  return NextResponse.json({ subscribers });
}
export const GET = withSanitizedErrors(GET_impl);

/**
 * POST /api/mvno/real/subscribers
 * body: { fullName, idNumberLast4, simIccid?, ratePlanId? }
 * msisdn is deliberately NOT set here — a real number only exists once
 * assigned by whichever MVNE/MNO partner actually provisions it; this
 * record starts as "pending_number" until that's recorded separately.
 */
async function POST_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { fullName, idNumberLast4, simIccid, ratePlanId } = body || {};
  if (!fullName) return NextResponse.json({ error: 'fullName is required' }, { status: 400 });
  if (idNumberLast4 && !/^\d{4}$/.test(idNumberLast4)) {
    return NextResponse.json({ error: 'idNumberLast4 must be exactly 4 digits' }, { status: 400 });
  }

  let sim = null;
  if (simIccid) {
    sim = db.mvnoSimInventory.find((s) => s.ownerId === user.id && s.iccid === simIccid);
    if (!sim) return NextResponse.json({ error: 'No SIM with that ICCID found in your inventory' }, { status: 400 });
    if (sim.assignedSubscriberId) return NextResponse.json({ error: 'That SIM is already assigned to another subscriber' }, { status: 409 });
  }
  if (ratePlanId) {
    const plan = db.mvnoRatePlans.find((p) => p.id === ratePlanId && p.ownerId === user.id);
    if (!plan) return NextResponse.json({ error: 'ratePlanId does not match one of your rate plans' }, { status: 400 });
  }

  const record = {
    id: crypto.randomUUID(),
    ownerId: user.id,
    fullName,
    idNumberLast4: idNumberLast4 || null,
    ricaVerified: false,
    ricaVerifiedAt: null,
    msisdn: null,
    status: 'pending_number',
    simIccid: sim ? sim.iccid : null,
    ratePlanId: ratePlanId || null,
    registeredAt: new Date().toISOString()
  };
  await db.mvnoSubscribers.insert(record);

  if (sim) {
    await db.mvnoSimInventory.update((s) => s.id === sim.id, { status: 'assigned', assignedSubscriberId: record.id });
  }

  return NextResponse.json(record, { status: 201 });
}
export const POST = withSanitizedErrors(POST_impl);
