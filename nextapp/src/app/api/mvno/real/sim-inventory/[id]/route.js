import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

const VALID_STATUSES = ['in_stock', 'assigned', 'activated', 'suspended', 'deactivated'];

/**
 * PATCH /api/mvno/real/sim-inventory/:id
 * body: { status?, batchNote? }
 * Manually moving a SIM out of "assigned" (e.g. back to "in_stock") does
 * NOT automatically clear the subscriber it was assigned to — do that via
 * the subscriber record itself, so the two records can't silently drift
 * out of sync with each other.
 */
async function PATCH_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const sim = db.mvnoSimInventory.find((s) => s.id === id && s.ownerId === user.id);
  if (!sim) return NextResponse.json({ error: 'SIM not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { status, batchNote } = body || {};
  const updates = {};
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }
    updates.status = status;
  }
  if (batchNote !== undefined) updates.batchNote = batchNote;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const updated = await db.mvnoSimInventory.update((s) => s.id === sim.id, updates);
  return NextResponse.json(updated);
}
export const PATCH = withSanitizedErrors(PATCH_impl);

/**
 * DELETE /api/mvno/real/sim-inventory/:id
 */
async function DELETE_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const sim = db.mvnoSimInventory.find((s) => s.id === id && s.ownerId === user.id);
  if (!sim) return NextResponse.json({ error: 'SIM not found' }, { status: 404 });
  if (sim.assignedSubscriberId) {
    return NextResponse.json({ error: 'This SIM is assigned to a subscriber — unassign it first' }, { status: 409 });
  }

  await db.mvnoSimInventory.remove((s) => s.id === sim.id);
  return new NextResponse(null, { status: 204 });
}
export const DELETE = withSanitizedErrors(DELETE_impl);
