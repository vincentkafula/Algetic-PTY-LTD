import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * PATCH /api/mvno/real/rate-plans/:id
 * body: any subset of { name, dataGB, voiceMinutes, smsCount, priceZAR, active }
 */
async function PATCH_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const plan = db.mvnoRatePlans.find((p) => p.id === id && p.ownerId === user.id);
  if (!plan) return NextResponse.json({ error: 'Rate plan not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const allowed = ['name', 'dataGB', 'voiceMinutes', 'smsCount', 'priceZAR', 'active'];
  const updates = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if (updates.priceZAR !== undefined && (typeof updates.priceZAR !== 'number' || updates.priceZAR < 0)) {
    return NextResponse.json({ error: 'priceZAR must be a number 0 or greater' }, { status: 400 });
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const updated = await db.mvnoRatePlans.update((p) => p.id === plan.id, updates);
  return NextResponse.json(updated);
}
export const PATCH = withSanitizedErrors(PATCH_impl);

/**
 * DELETE /api/mvno/real/rate-plans/:id
 */
async function DELETE_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const plan = db.mvnoRatePlans.find((p) => p.id === id && p.ownerId === user.id);
  if (!plan) return NextResponse.json({ error: 'Rate plan not found' }, { status: 404 });

  const inUse = db.mvnoSubscribers.find((s) => s.ownerId === user.id && s.ratePlanId === plan.id);
  if (inUse) {
    return NextResponse.json({ error: 'This plan is still assigned to a subscriber — reassign or remove them first' }, { status: 409 });
  }

  await db.mvnoRatePlans.remove((p) => p.id === plan.id);
  return new NextResponse(null, { status: 204 });
}
export const DELETE = withSanitizedErrors(DELETE_impl);
