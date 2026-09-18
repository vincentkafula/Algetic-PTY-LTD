import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng, REGIONS } = require('@/lib/mvnoDemo');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/mvno/incidents
 * Simulated network incidents/maintenance log — separate from the
 * fraud-alerts endpoint, this is operational (outages, degraded
 * service, planned maintenance) rather than security-related. Demo
 * data only, same as every other MVNO endpoint.
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const r = makeRng(user.id + ':incidents');
  const types = ['degraded_data_service', 'planned_maintenance', 'tower_offline', 'core_network_latency', 'resolved_outage'];
  const severities = ['critical', 'major', 'minor', 'info'];
  const incidents = Array.from({ length: 6 }, (_, i) => {
    const resolved = i > 1;
    return {
      id: `INC-${String(i + 1).padStart(4, '0')}`,
      type: types[i % types.length],
      severity: severities[i % severities.length],
      region: r.pick(REGIONS),
      status: resolved ? 'resolved' : 'active',
      startedAt: new Date(Date.now() - r.int(1, 240) * 3600000).toISOString(),
      resolvedAt: resolved ? new Date(Date.now() - r.int(1, 200) * 3600000).toISOString() : null
    };
  });
  return NextResponse.json({
    demo: true,
    data: {
      activeIncidents: incidents.filter((x) => x.status === 'active').length,
      incidents
    }
  });
}
export const GET = withSanitizedErrors(GET_impl);
