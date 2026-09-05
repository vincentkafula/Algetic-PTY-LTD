import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { twilioClient, isTwilioConfigured } = require('@/lib/twilioClient');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * POST /api/call-centre/numbers/:numberId/unassign
 * Clears the Voice URL. The number is left with no call handling at all
 * — re-provisioning trunk attachment is a separate step, not automatic.
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
  if (!isTwilioConfigured()) {
    return NextResponse.json({ error: 'Server is missing Twilio configuration in .env' }, { status: 500 });
  }

  try {
    await twilioClient.incomingPhoneNumbers(number.twilioSid).update({ voiceUrl: '' });
    const updated = await db.numbers.update((n) => n.id === number.id, { callCentreMenuId: null });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export const POST = withSanitizedErrors(POST_impl);
