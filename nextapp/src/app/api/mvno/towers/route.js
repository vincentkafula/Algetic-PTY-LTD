import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng, REGIONS, TECH } = require('@/lib/mvnoDemo');

/**
 * GET /api/mvno/towers
 */
export async function GET(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const r = makeRng(user.id + ':towers');
  const towers = Array.from({ length: 24 }, (_, i) => {
    const roll = i % 15;
    const status = roll === 0 ? 'offline' : roll === 7 ? 'warning' : 'online';
    return {
      id: `TWR-${String(i + 1).padStart(4, '0')}`,
      name: `Tower ${i + 1}`,
      region: REGIONS[i % REGIONS.length],
      technology: TECH[i % TECH.length],
      status,
      loadPercent: r.int(18, 96),
      connectedSubscribers: r.int(40, 780)
    };
  });
  return NextResponse.json({ demo: true, data: towers });
}
