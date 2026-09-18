import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng, REGIONS } = require('@/lib/mvnoDemo');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/mvno/sim-inventory
 * Simulated SIM/eSIM stock levels by region and a pending-activation
 * queue count — demo data only, same as every other MVNO endpoint.
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const r = makeRng(user.id + ':sim-inventory');
  const byRegion = REGIONS.map((region) => ({
    region,
    physicalSimsInStock: r.int(500, 8000),
    esimProfilesAvailable: r.int(2000, 20000),
    pendingActivations: r.int(5, 120)
  }));
  return NextResponse.json({
    demo: true,
    data: {
      totalPhysicalSims: byRegion.reduce((sum, x) => sum + x.physicalSimsInStock, 0),
      totalEsimProfiles: byRegion.reduce((sum, x) => sum + x.esimProfilesAvailable, 0),
      totalPendingActivations: byRegion.reduce((sum, x) => sum + x.pendingActivations, 0),
      lowStockRegions: byRegion.filter((x) => x.physicalSimsInStock < 1500).map((x) => x.region),
      byRegion
    }
  });
}
export const GET = withSanitizedErrors(GET_impl);
