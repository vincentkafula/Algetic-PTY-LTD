import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * DELETE /api/projects/:id
 */
async function DELETE_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const project = db.projects.find((p) => p.id === id && p.ownerId === user.id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  await db.projects.remove((p) => p.id === project.id);
  return new NextResponse(null, { status: 204 });
}
export const DELETE = withSanitizedErrors(DELETE_impl);
