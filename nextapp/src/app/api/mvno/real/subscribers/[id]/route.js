import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

const VALID_STATUSES = ['pending_number', 'pending_rica', 'active', 'suspended', 'ported_out', 'deactivated'];

/**
 * PATCH /api/mvno/real/subscribers/:id
 * body: any subset of { fullName, idNumberLast4, msisdn, status, ricaVerified, ratePlanId }
 * msisdn is set here once a real number has actually been assigned by
 * whichever MVNE/MNO partner is providing connectivity — this endpoint
 * doesn't call any network API itself, it just records what happened.
 */
async function PATCH_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const subscriber = db.mvnoSubscribers.find((s) => s.id === id && s.ownerId === user.id);
  if (!subscriber) return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { fullName, idNumberLast4, msisdn, status, ricaVerified, ratePlanId } = body || {};
  const updates = {};

  if (fullName !== undefined) {
    if (!fullName) return NextResponse.json({ error: 'fullName cannot be empty' }, { status: 400 });
    updates.fullName = fullName;
  }
  if (idNumberLast4 !== undefined) {
    if (idNumberLast4 !== null && !/^\d{4}$/.test(idNumberLast4)) {
      return NextResponse.json({ error: 'idNumberLast4 must be exactly 4 digits' }, { status: 400 });
    }
    updates.idNumberLast4 = idNumberLast4;
  }
  if (msisdn !== undefined) {
    if (msisdn !== null && !/^\+[1-9]\d{6,14}$/.test(msisdn)) {
      return NextResponse.json({ error: 'msisdn must be in E.164 format, e.g. +27821234567' }, { status: 400 });
    }
    updates.msisdn = msisdn;
  }
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }
    updates.status = status;
  }
  if (ricaVerified !== undefined) {
    if (typeof ricaVerified !== 'boolean') return NextResponse.json({ error: 'ricaVerified must be true or false' }, { status: 400 });
    updates.ricaVerified = ricaVerified;
    updates.ricaVerifiedAt = ricaVerified ? new Date().toISOString() : null;
  }
  if (ratePlanId !== undefined) {
    if (ratePlanId !== null) {
      const plan = db.mvnoRatePlans.find((p) => p.id === ratePlanId && p.ownerId === user.id);
      if (!plan) return NextResponse.json({ error: 'ratePlanId does not match one of your rate plans' }, { status: 400 });
    }
    updates.ratePlanId = ratePlanId;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const updated = await db.mvnoSubscribers.update((s) => s.id === subscriber.id, updates);
  return NextResponse.json(updated);
}
export const PATCH = withSanitizedErrors(PATCH_impl);

/**
 * DELETE /api/mvno/real/subscribers/:id
 * Also frees up their assigned SIM (back to in_stock) rather than leaving
 * it permanently marked "assigned" to a subscriber that no longer exists.
 */
async function DELETE_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const subscriber = db.mvnoSubscribers.find((s) => s.id === id && s.ownerId === user.id);
  if (!subscriber) return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });

  if (subscriber.simIccid) {
    const sim = db.mvnoSimInventory.find((s) => s.ownerId === user.id && s.iccid === subscriber.simIccid);
    if (sim) {
      await db.mvnoSimInventory.update((s) => s.id === sim.id, { status: 'in_stock', assignedSubscriberId: null });
    }
  }

  await db.mvnoSubscribers.remove((s) => s.id === subscriber.id);
  return new NextResponse(null, { status: 204 });
}
export const DELETE = withSanitizedErrors(DELETE_impl);
