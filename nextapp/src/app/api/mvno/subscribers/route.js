import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng } = require('@/lib/mvnoDemo');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/mvno/subscribers
 * A sample page, not a full subscriber base — this is a demo, not a real
 * customer database.
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const r = makeRng(user.id + ':subs');
  const statuses = ['active', 'active', 'active', 'suspended', 'porting'];
  const plans = ['Prepaid 5GB', 'Prepaid 20GB', 'Postpaid 50GB', 'Postpaid Unlimited'];
  const subscribers = Array.from({ length: 15 }, (_, i) => ({
    msisdn: `+27${r.int(60, 84)}${String(r.int(1000000, 9999999))}`,
    status: statuses[i % statuses.length],
    plan: plans[i % plans.length],
    dataBalanceMB: r.int(0, 20000),
    homeNetwork: 'ZA-DEMO',
    roaming: r.int(0, 9) === 0
  }));
  return NextResponse.json({ demo: true, data: subscribers });
}
export const GET = withSanitizedErrors(GET_impl);
