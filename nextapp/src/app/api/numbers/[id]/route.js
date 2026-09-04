import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { twilioClient, isTwilioConfigured } = require('@/lib/twilioClient');

/**
 * DELETE /api/numbers/:id
 * Releases the number back to Twilio (stops billing for it) and removes
 * the local record. Only the owning account can release its own number.
 */
export async function DELETE(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const record = db.numbers.find((n) => n.id === id && n.ownerId === user.id);
  if (!record) return NextResponse.json({ error: 'Number not found' }, { status: 404 });

  try {
    if (isTwilioConfigured() && record.twilioSid) {
      await twilioClient.incomingPhoneNumbers(record.twilioSid).remove();
    }
  } catch (err) {
    // Non-fatal if Twilio-side release fails (e.g. already removed) — we
    // still remove the local record so the dashboard stays accurate.
    console.error('Failed to release Twilio number:', err.message);
  }

  await db.numbers.remove((n) => n.id === record.id);
  return new NextResponse(null, { status: 204 });
}
