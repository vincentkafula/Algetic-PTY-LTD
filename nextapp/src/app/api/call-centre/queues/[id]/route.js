import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { twilioClient, isTwilioConfigured } = require('@/lib/twilioClient');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

function isConfigured() {
  return isTwilioConfigured() && Boolean(process.env.PUBLIC_BASE_URL);
}

/**
 * DELETE /api/call-centre/queues/:id
 */
async function DELETE_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const queue = db.callQueues.find((q) => q.id === id && q.ownerId === user.id);
  if (!queue) return NextResponse.json({ error: 'Queue not found' }, { status: 404 });

  const inUse = db.ivrMenus.find((m) => m.ownerId === user.id && (m.options || []).some((o) => o.action === 'queue' && o.target === queue.id));
  if (inUse) {
    return NextResponse.json({ error: `Menu "${inUse.name}" still routes to this queue — update or delete that menu first` }, { status: 409 });
  }

  try {
    if (isConfigured() && queue.twilioQueueSid) {
      await twilioClient.queues(queue.twilioQueueSid).remove();
    }
  } catch (err) {
    console.error('Failed to delete Twilio queue:', err.message);
  }
  await db.callQueues.remove((q) => q.id === queue.id);
  return new NextResponse(null, { status: 204 });
}
export const DELETE = withSanitizedErrors(DELETE_impl);
