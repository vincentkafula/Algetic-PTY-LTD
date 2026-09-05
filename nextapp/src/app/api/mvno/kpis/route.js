import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng } = require('@/lib/mvnoDemo');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/mvno/kpis
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const r = makeRng(user.id);
  const totalSubscribers = r.int(180000, 260000);
  return NextResponse.json({
    demo: true,
    data: {
      timestamp: new Date().toISOString(),
      totalSubscribers,
      activeSubscribers: Math.round(totalSubscribers * r.float(0.72, 0.85, 2)),
      networkUptimePct: r.float(99.90, 99.99, 2),
      activeDataSessions: r.int(80000, 140000),
      activeVoiceCalls: r.int(2000, 6000),
      smsQueueDepth: r.int(50, 400),
      revenueTodayZAR: r.int(180000, 320000),
      fraudAlertsActive: r.int(2, 18),
      avgNetworkLoadPct: r.int(45, 82),
      totalTowerCount: 24,
      towersOnline: r.int(21, 24),
      activeSims: totalSubscribers,
      openTickets: r.int(80, 260),
      roamingUsers: r.int(400, 2200),
      dataThroughputGbps: r.float(4.5, 12.0, 1)
    }
  });
}
export const GET = withSanitizedErrors(GET_impl);
