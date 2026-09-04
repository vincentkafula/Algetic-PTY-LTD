import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');

/**
 * DELETE /api/call-centre/agents/:id
 */
export async function DELETE(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const agent = db.callAgents.find((a) => a.id === id && a.ownerId === user.id);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  await db.callAgents.remove((a) => a.id === agent.id);
  return new NextResponse(null, { status: 204 });
}
