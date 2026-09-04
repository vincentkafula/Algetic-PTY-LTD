import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng } = require('@/lib/mvnoDemo');

/**
 * GET /api/mvno/billing-summary
 */
export async function GET(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const r = makeRng(user.id + ':billing');
  return NextResponse.json({
    demo: true,
    data: {
      revenueTodayZAR: r.int(180000, 320000),
      revenueMTDZAR: r.int(3800000, 6200000),
      invoicesOverdue: r.int(20, 180),
      invoicesPaid: r.int(4000, 9000),
      avgRevenuePerUserZAR: r.float(85, 240, 2)
    }
  });
}
