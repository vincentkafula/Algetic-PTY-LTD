import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireRole } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/admin/users
 * Lists every account on the platform — the whole point of the 'admin'
 * role, and exactly why it can't be self-granted at signup (see
 * signup/route.js). Never includes passwordHash, regardless of how
 * privileged the caller is — there's no legitimate reason an admin view
 * needs it, and returning it would be a real credential-exposure risk if
 * this response were ever logged, cached, or otherwise leaked.
 */
async function GET_impl(request) {
  try {
    requireRole(request, ['admin']);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const users = db.users.all().map((u) => ({
    id: u.id,
    email: u.email,
    companyName: u.companyName || null,
    role: u.role || 'purchasing',
    createdAt: u.createdAt
  }));
  return NextResponse.json({ users });
}
export const GET = withSanitizedErrors(GET_impl);
