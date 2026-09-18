import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { makeRng } = require('@/lib/mvnoDemo');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/mvno/traffic
 * 24 hourly data points for data/voice/SMS volume — simulated, same as
 * every other MVNO endpoint. A rough sine-ish curve (higher during
 * daytime hours, lower overnight) rather than pure noise, so the shape
 * reads as a plausible daily traffic pattern rather than random static.
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const r = makeRng(user.id + ':traffic');
  const hours = Array.from({ length: 24 }, (_, h) => {
    const dayCurve = Math.sin(((h - 6) / 24) * Math.PI * 2) * 0.5 + 0.5; // peaks mid-afternoon, troughs overnight
    return {
      hour: `${String(h).padStart(2, '0')}:00`,
      dataGB: Math.round((r.float(20, 60) + dayCurve * r.float(40, 90)) * 10) / 10,
      voiceMinutes: Math.round(r.int(800, 2000) + dayCurve * r.int(2000, 6000)),
      smsCount: Math.round(r.int(200, 600) + dayCurve * r.int(500, 1500))
    };
  });
  return NextResponse.json({ demo: true, data: hours });
}
export const GET = withSanitizedErrors(GET_impl);
