import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng } = require('@/lib/mvnoDemo');

/**
 * GET /api/mvno/fraud-alerts
 */
export async function GET(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const r = makeRng(user.id + ':fraud');
  const types = ['sim_swap', 'roaming_abuse', 'premium_rate', 'cloning', 'bypass'];
  const severities = ['critical', 'warning', 'info'];
  const alerts = Array.from({ length: 8 }, (_, i) => ({
    id: `FRD-${String(i + 1).padStart(3, '0')}`,
    type: types[i % types.length],
    severity: severities[i % severities.length],
    msisdn: `+27${r.int(60, 84)}${String(r.int(1000000, 9999999))}`,
    riskScore: r.float(1, 10, 1),
    detectedAt: new Date(Date.now() - r.int(1, 720) * 60000).toISOString()
  }));
  return NextResponse.json({ demo: true, data: alerts });
}
