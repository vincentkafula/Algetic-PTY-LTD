import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng } = require('@/lib/mvnoDemo');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/mvno/plans
 * Simulated prepaid/postpaid bundle catalog with subscriber counts per
 * plan — demo data only, same as every other MVNO endpoint.
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const r = makeRng(user.id + ':plans');
  const plans = [
    { name: 'PAYG Starter', type: 'prepaid', dataGB: 0, voiceMinutes: 0, priceZAR: 0 },
    { name: 'Prepaid 1GB', type: 'prepaid', dataGB: 1, voiceMinutes: 50, priceZAR: 39 },
    { name: 'Prepaid 5GB', type: 'prepaid', dataGB: 5, voiceMinutes: 150, priceZAR: 99 },
    { name: 'Prepaid 20GB', type: 'prepaid', dataGB: 20, voiceMinutes: 300, priceZAR: 199 },
    { name: 'Postpaid 50GB', type: 'postpaid', dataGB: 50, voiceMinutes: 1000, priceZAR: 399 },
    { name: 'Postpaid Unlimited', type: 'postpaid', dataGB: null, voiceMinutes: null, priceZAR: 699 }
  ];
  const data = plans.map((p) => ({
    ...p,
    activeSubscribers: r.int(2000, 45000),
    revenueMTDZAR: r.int(80000, 3200000)
  }));
  return NextResponse.json({ demo: true, data });
}
export const GET = withSanitizedErrors(GET_impl);
