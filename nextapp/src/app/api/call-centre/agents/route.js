import { NextResponse } from 'next/server';

const crypto = require('crypto');
const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/call-centre/agents
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  const agents = db.callAgents.filter((a) => a.ownerId === user.id);
  return NextResponse.json({ agents });
}

/**
 * POST /api/call-centre/agents
 * body: { name, phoneNumber, queueId }
 * phoneNumber is whatever number Twilio should ring to reach this agent
 * — their cell, a desk phone, or a registered Team Calling SIP address
 * given as a full `sip:username@domain` URI.
 */
async function POST_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, phoneNumber, queueId } = body || {};
  if (!name || !phoneNumber || !queueId) {
    return NextResponse.json({ error: 'name, phoneNumber, and queueId are required' }, { status: 400 });
  }
  if (!/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
    return NextResponse.json({ error: 'phoneNumber must be in E.164 format, e.g. +14155551234' }, { status: 400 });
  }
  const queue = db.callQueues.find((q) => q.id === queueId && q.ownerId === user.id);
  if (!queue) return NextResponse.json({ error: 'queueId does not match one of your queues' }, { status: 400 });

  const record = {
    id: crypto.randomUUID(),
    ownerId: user.id,
    name,
    phoneNumber,
    queueId,
    available: true,
    createdAt: new Date().toISOString()
  };
  await db.callAgents.insert(record);
  return NextResponse.json(record, { status: 201 });
}
export const GET = withSanitizedErrors(GET_impl);
export const POST = withSanitizedErrors(POST_impl);
