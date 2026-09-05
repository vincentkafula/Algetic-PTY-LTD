import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const trunking = require('@/lib/services/trunking');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * POST /api/numbers/trunk/origination
 * body: { sipUri: "sip:203.0.113.10:5060" }
 * Sets where inbound calls to this account's numbers are delivered — the
 * customer's own PBX/SBC/softphone public SIP address. This is NOT
 * "enter your softphone's registration details" — Twilio Elastic SIP
 * Trunking cannot accept a device that isn't reachable at a fixed
 * address. See services/trunking.js for the fuller explanation.
 */
async function POST_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { sipUri } = body || {};
  if (!sipUri) return NextResponse.json({ error: 'sipUri is required, e.g. sip:203.0.113.10:5060' }, { status: 400 });

  try {
    const updated = await trunking.setOriginationUri(user.id, sipUri);
    return NextResponse.json({ trunk: trunking.publicTrunk(updated) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
export const POST = withSanitizedErrors(POST_impl);
