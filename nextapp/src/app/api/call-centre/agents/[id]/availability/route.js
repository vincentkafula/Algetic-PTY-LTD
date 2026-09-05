import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * PATCH /api/call-centre/agents/:id/availability
 * body: { available: true|false }
 */
async function PATCH_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const agent = db.callAgents.find((a) => a.id === id && a.ownerId === user.id);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { available } = body || {};
  if (typeof available !== 'boolean') return NextResponse.json({ error: 'available must be true or false' }, { status: 400 });

  const updated = await db.callAgents.update((a) => a.id === agent.id, { available });
  return NextResponse.json(updated);
}
export const PATCH = withSanitizedErrors(PATCH_impl);
