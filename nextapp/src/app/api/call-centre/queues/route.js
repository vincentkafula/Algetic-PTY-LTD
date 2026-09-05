import { NextResponse } from 'next/server';

const crypto = require('crypto');
const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { twilioClient, isTwilioConfigured } = require('@/lib/twilioClient');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

function isConfigured() {
  return isTwilioConfigured() && Boolean(process.env.PUBLIC_BASE_URL);
}

/**
 * GET /api/call-centre/queues
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  const queues = db.callQueues.filter((q) => q.ownerId === user.id);
  return NextResponse.json({ queues });
}

/**
 * POST /api/call-centre/queues
 * body: { name }
 * Creates both the local record and the actual Twilio Queue resource —
 * <Enqueue>/<Dial><Queue> address queues by name, so the Twilio-side
 * queue has to exist.
 */
async function POST_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name } = body || {};
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Server is missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / PUBLIC_BASE_URL in .env' }, { status: 500 });
  }

  // Twilio queue names are scoped per account, so prefix with the Altegic
  // account id to avoid two different Altegic customers' queues colliding
  // inside the same Twilio account.
  const twilioQueueName = `${user.id}-${name}`.slice(0, 64);

  try {
    const queue = await twilioClient.queues.create({ friendlyName: twilioQueueName, maxSize: 100 });
    const record = {
      id: crypto.randomUUID(),
      ownerId: user.id,
      name,
      twilioQueueSid: queue.sid,
      twilioQueueName,
      createdAt: new Date().toISOString()
    };
    await db.callQueues.insert(record);
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export const GET = withSanitizedErrors(GET_impl);
export const POST = withSanitizedErrors(POST_impl);
