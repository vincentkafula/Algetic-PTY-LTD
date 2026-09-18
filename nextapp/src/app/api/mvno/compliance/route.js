import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng } = require('@/lib/mvnoDemo');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/mvno/compliance
 * Simulated RICA (Regulation of Interception of Communications Act)
 * registration compliance status — South African law requiring every
 * SIM to be registered against verified ID/address details. Demo data
 * only, same as every other MVNO endpoint; a real implementation would
 * integrate with RICA's actual verification systems, not something
 * simulated here.
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const r = makeRng(user.id + ':compliance');
  const totalSims = r.int(180000, 260000);
  const unregistered = r.int(1200, 8000);
  return NextResponse.json({
    demo: true,
    data: {
      totalActiveSims: totalSims,
      ricaRegisteredSims: totalSims - unregistered,
      ricaRegisteredPct: Number((((totalSims - unregistered) / totalSims) * 100).toFixed(1)),
      pendingVerification: r.int(300, 1500),
      unregisteredAtRiskOfSuspension: unregistered,
      icasaLicenseStatus: 'active',
      lastComplianceAuditDate: new Date(Date.now() - r.int(30, 180) * 86400000).toISOString()
    }
  });
}
export const GET = withSanitizedErrors(GET_impl);
