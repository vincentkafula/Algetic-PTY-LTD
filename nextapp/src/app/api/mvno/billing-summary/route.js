import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng } = require('@/lib/mvnoDemo');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/mvno/billing-summary
 */
async function GET_impl(request) {
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
export const GET = withSanitizedErrors(GET_impl);
