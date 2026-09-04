import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng } = require('@/lib/mvnoDemo');

/**
 * GET /api/mvno/roaming
 */
export async function GET(request) {
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
