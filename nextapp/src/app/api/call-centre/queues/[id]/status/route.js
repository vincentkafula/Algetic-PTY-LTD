import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { twilioClient, isTwilioConfigured } = require('@/lib/twilioClient');

function isConfigured() {
  return isTwilioConfigured() && Boolean(process.env.PUBLIC_BASE_URL);
}

/**
 * GET /api/call-centre/queues/:id/status
 * Live queue depth from Twilio — how many callers are currently waiting.
 */
export async function GET(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const queue = db.callQueues.find((q) => q.id === id && q.ownerId === user.id);
  if (!queue) return NextResponse.json({ error: 'Queue not found' }, { status: 404 });
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Server is missing Twilio configuration in .env' }, { status: 500 });
  }
  try {
    const twilioQueue = await twilioClient.queues(queue.twilioQueueSid).fetch();
    return NextResponse.json({ currentSize: twilioQueue.currentSize, averageWaitTime: twilioQueue.averageWaitTime });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
