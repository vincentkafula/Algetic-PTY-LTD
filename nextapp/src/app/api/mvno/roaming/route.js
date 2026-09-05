import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng } = require('@/lib/mvnoDemo');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/mvno/roaming
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const r = makeRng(user.id + ':roaming');
  const partners = ['Vodafone UK', 'AT&T', 'Deutsche Telekom', 'Telstra', 'Orange France', 'MTN Nigeria'];
  const data = partners.map((networkName, i) => ({
    networkName,
    country: ['United Kingdom', 'United States', 'Germany', 'Australia', 'France', 'Nigeria'][i],
    status: i === 5 ? 'restricted' : 'active',
    activeRoamers: r.int(50, 900),
    revenue30dUSD: r.int(2000, 45000)
  }));
  return NextResponse.json({ demo: true, data });
}
export const GET = withSanitizedErrors(GET_impl);
