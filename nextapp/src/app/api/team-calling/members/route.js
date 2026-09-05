import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { isTwilioConfigured } = require('@/lib/twilioClient');
const sipDomain = require('@/lib/services/sipDomain');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

function isConfigured() {
  return isTwilioConfigured() && Boolean(process.env.PUBLIC_BASE_URL);
}

/**
 * GET /api/team-calling/members
 */
async function GET_impl(request) {
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
    const result = await sipDomain.listMembers(user.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}

/**
 * POST /api/team-calling/members
 * body: { username, password }
 * Adds a member, or resets their password if the username already
 * exists. Password is supplied by the caller (not generated).
 */
async function POST_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Server is missing Twilio configuration or PUBLIC_BASE_URL in .env' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { username, password } = body || {};
  if (!username || !password || password.length < 8) {
    return NextResponse.json({ error: 'username and a password (min 8 characters) are required' }, { status: 400 });
  }
  try {
    const result = await sipDomain.addOrResetMember(user.id, username, password);
    const domainRecord = await sipDomain.ensureDomainForAccount(user.id);
    return NextResponse.json({ ...result, domainName: domainRecord.domainName }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
export const GET = withSanitizedErrors(GET_impl);
export const POST = withSanitizedErrors(POST_impl);
