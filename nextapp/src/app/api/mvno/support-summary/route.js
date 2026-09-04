import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng } = require('@/lib/mvnoDemo');

/**
 * GET /api/mvno/support-summary
 */
export async function GET(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const r = makeRng(user.id + ':support');
  return NextResponse.json({
    demo: true,
    data: {
      openTickets: r.int(80, 260),
      avgResolutionHours: r.float(2, 18, 1),
      csatScore: r.float(3.6, 4.8, 1),
      categories: {
        billing: r.int(20, 80),
        technical: r.int(30, 100),
        porting: r.int(5, 30),
        activation: r.int(10, 40),
        roaming: r.int(2, 15),
        fraud: r.int(1, 10)
      }
    }
  });
}
