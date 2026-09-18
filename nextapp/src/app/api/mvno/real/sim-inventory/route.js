import { NextResponse } from 'next/server';

const crypto = require('crypto');
const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

// ---------------------------------------------------------------------------
// REAL, PERSISTENT SIM inventory — manually tracked, since no automated
// MVNE/MNO provisioning API exists to integrate with yet. In practice this
// means: an operator receives a physical SIM batch or eSIM profile batch
// from whichever MVNE/MNO partner they onboard with, and records it here
// as a source of truth for their own operations/reporting, rather than
// relying solely on the partner's own portal. Once a real MVNE API
// integration exists, this table is exactly what an automated sync would
// write into — the data model doesn't need to change, only how it gets
// populated.
// ---------------------------------------------------------------------------

/**
 * GET /api/mvno/real/sim-inventory
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  const sims = db.mvnoSimInventory.filter((s) => s.ownerId === user.id);
  return NextResponse.json({ sims });
}
export const GET = withSanitizedErrors(GET_impl);

/**
 * POST /api/mvno/real/sim-inventory
 * body: { iccid, type: "physical"|"esim", batchNote? }
 * Records a SIM/eSIM as received into stock, unassigned. ICCID (the SIM's
 * own serial number, printed on physical cards or provided in an eSIM
 * profile) must be unique per account.
 */
async function POST_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { iccid, type, batchNote } = body || {};
  if (!iccid || !type) return NextResponse.json({ error: 'iccid and type are required' }, { status: 400 });
  if (!['physical', 'esim'].includes(type)) {
    return NextResponse.json({ error: 'type must be "physical" or "esim"' }, { status: 400 });
  }

  const dup = db.mvnoSimInventory.find((s) => s.ownerId === user.id && s.iccid === iccid);
  if (dup) return NextResponse.json({ error: `A SIM with ICCID ${iccid} is already recorded` }, { status: 409 });

  const record = {
    id: crypto.randomUUID(),
    ownerId: user.id,
    iccid,
    type,
    status: 'in_stock',
    assignedSubscriberId: null,
    batchNote: batchNote || null,
    receivedAt: new Date().toISOString()
  };
  await db.mvnoSimInventory.insert(record);
  return NextResponse.json(record, { status: 201 });
}
export const POST = withSanitizedErrors(POST_impl);
