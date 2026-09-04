import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');

const VALID_STATUSES = ['Requested', 'In Progress', 'Delivered', 'Cancelled'];

/**
 * PATCH /api/projects/:id/status
 * body: { status }
 */
export async function PATCH(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const project = db.projects.find((p) => p.id === id && p.ownerId === user.id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { status } = body || {};
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const updated = await db.projects.update((p) => p.id === project.id, { status, updatedAt: new Date().toISOString() });
  return NextResponse.json(updated);
}
