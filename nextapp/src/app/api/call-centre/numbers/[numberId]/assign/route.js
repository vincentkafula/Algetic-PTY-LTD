import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { twilioClient, isTwilioConfigured } = require('@/lib/twilioClient');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

function isConfigured() {
  return isTwilioConfigured() && Boolean(process.env.PUBLIC_BASE_URL);
}

/**
 * POST /api/call-centre/numbers/:numberId/assign
 * body: { menuId }
 * Points the number's Voice URL at this app's TwiML webhook and detaches
 * it from any SIP trunk it was on — a number can't be on a trunk AND
 * have its own Voice URL honored at the same time.
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
  const { menuId } = body || {};
  const menu = db.ivrMenus.find((m) => m.id === menuId && m.ownerId === user.id);
  if (!menu) return NextResponse.json({ error: 'menuId does not match one of your menus' }, { status: 400 });
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Server is missing Twilio configuration or PUBLIC_BASE_URL in .env' }, { status: 500 });
  }

  try {
    if (number.trunkId) {
      const trunk = db.trunks.find((t) => t.id === number.trunkId);
      if (trunk) {
        try {
          await twilioClient.trunking.v1.trunks(trunk.trunkSid).phoneNumbers(number.twilioSid).remove();
        } catch (err) {
          console.error('Failed to detach number from trunk before call-centre assignment:', err.message);
        }
      }
    }

    const voiceUrl = `${process.env.PUBLIC_BASE_URL}/api/webhooks/twilio/voice?menuId=${menu.id}`;
    await twilioClient.incomingPhoneNumbers(number.twilioSid).update({ voiceUrl, voiceMethod: 'POST' });

    const updated = await db.numbers.update((n) => n.id === number.id, { callCentreMenuId: menu.id, trunkId: null, teamCallingMember: null });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export const POST = withSanitizedErrors(POST_impl);
