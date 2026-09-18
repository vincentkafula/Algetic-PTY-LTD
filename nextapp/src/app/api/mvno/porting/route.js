import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng } = require('@/lib/mvnoDemo');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/mvno/porting
 * Simulated Mobile Number Portability (MNP) queue — South Africa's real
 * porting process runs through the industry Number Portability Database
 * (NPDB), a shared system between all networks. Demo data only, same as
 * every other MVNO endpoint.
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const r = makeRng(user.id + ':porting');
  const networks = ['Vodacom', 'MTN', 'Cell C', 'Telkom Mobile', 'Rain'];
  const statuses = ['pending_validation', 'scheduled', 'in_progress', 'completed', 'rejected'];
  const requests = Array.from({ length: 10 }, (_, i) => ({
    id: `PORT-${String(i + 1).padStart(4, '0')}`,
    direction: i % 3 === 0 ? 'porting_out' : 'porting_in',
    otherNetwork: r.pick(networks),
    msisdn: `+27${r.int(60, 84)}${String(r.int(1000000, 9999999))}`,
    status: statuses[i % statuses.length],
    submittedAt: new Date(Date.now() - r.int(1, 72) * 3600000).toISOString(),
    scheduledPortDate: statuses[i % statuses.length] === 'scheduled' ? new Date(Date.now() + r.int(1, 5) * 86400000).toISOString() : null
  }));
  return NextResponse.json({
    demo: true,
    data: {
      pendingCount: requests.filter((x) => ['pending_validation', 'scheduled', 'in_progress'].includes(x.status)).length,
      completedThisMonth: r.int(80, 600),
      requests
    }
  });
}
export const GET = withSanitizedErrors(GET_impl);
