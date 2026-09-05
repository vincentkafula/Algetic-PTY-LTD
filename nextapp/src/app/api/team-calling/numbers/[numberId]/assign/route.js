import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { isTwilioConfigured, twilioClient } = require('@/lib/twilioClient');
const sipDomain = require('@/lib/services/sipDomain');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

function isConfigured() {
  return isTwilioConfigured() && Boolean(process.env.PUBLIC_BASE_URL);
}

/**
 * POST /api/team-calling/numbers/:numberId/assign
 * body: { username }
 * Points a purchased phone number's Voice URL at this account's team
 * member, so calling that real, public number rings the member's
 * registered softphone. Detaches the number from any SIP trunk or Call
 * Centre menu it was on first, same mutual-exclusivity rule as the rest
 * of the numbers feature.
 */
async function POST_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { numberId } = await params;
  const number = db.numbers.find((n) => n.id === numberId && n.ownerId === user.id);
  if (!number) return NextResponse.json({ error: 'Number not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { username } = body || {};
  if (!username) return NextResponse.json({ error: 'username is required' }, { status: 400 });
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Server is missing Twilio configuration or PUBLIC_BASE_URL in .env' }, { status: 500 });
  }

  try {
    const { members } = await sipDomain.listMembers(user.id);
    if (!members.includes(username)) {
      return NextResponse.json({ error: 'username does not match one of your team members' }, { status: 400 });
    }

    if (number.trunkId) {
      const trunk = db.trunks.find((t) => t.id === number.trunkId);
      if (trunk) {
        try {
          await twilioClient.trunking.v1.trunks(trunk.trunkSid).phoneNumbers(number.twilioSid).remove();
        } catch (err) {
          console.error('Failed to detach number from trunk before team-calling assignment:', err.message);
        }
      }
    }
    if (number.callCentreMenuId) {
      await twilioClient.incomingPhoneNumbers(number.twilioSid).update({ voiceUrl: '' });
    }

    const voiceUrl = `${process.env.PUBLIC_BASE_URL}/api/webhooks/twilio/team-voice?member=${encodeURIComponent(username)}`;
    await twilioClient.incomingPhoneNumbers(number.twilioSid).update({ voiceUrl, voiceMethod: 'POST' });

    const updated = await db.numbers.update(
      (n) => n.id === number.id,
      { teamCallingMember: username, trunkId: null, callCentreMenuId: null }
    );
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export const POST = withSanitizedErrors(POST_impl);
