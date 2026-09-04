import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { isTwilioConfigured } = require('@/lib/twilioClient');
const sipDomain = require('@/lib/services/sipDomain');

function isConfigured() {
  return isTwilioConfigured() && Boolean(process.env.PUBLIC_BASE_URL);
}

/**
 * GET /api/team-calling/domain
 * Returns (creating on first call) this account's SIP Domain name —
 * what a softphone registers to, as username@domainName.
 */
export async function GET(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Server is missing Twilio configuration or PUBLIC_BASE_URL in .env' }, { status: 500 });
  }
  try {
    const record = await sipDomain.ensureDomainForAccount(user.id);
    return NextResponse.json(sipDomain.publicDomain(record));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
