import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { isTwilioConfigured } = require('@/lib/twilioClient');
const sipDomain = require('@/lib/services/sipDomain');

function isConfigured() {
  return isTwilioConfigured() && Boolean(process.env.PUBLIC_BASE_URL);
}

/**
 * DELETE /api/team-calling/members/:username
 */
export async function DELETE(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Server is missing Twilio configuration or PUBLIC_BASE_URL in .env' }, { status: 500 });
  }

  const { username } = await params;
  try {
    await sipDomain.removeMember(user.id, username);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
