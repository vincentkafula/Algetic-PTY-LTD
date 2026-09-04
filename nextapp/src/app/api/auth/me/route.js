import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { publicUser } = require('@/lib/authTokens');

/**
 * GET /api/auth/me
 * Returns the logged-in account, so the dashboard can confirm the token
 * is still valid and show who's signed in.
 */
export async function GET(request) {
  let authedUser;
  try {
    authedUser = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const user = db.users.find((u) => u.id === authedUser.id);
  if (!user) {
    return NextResponse.json({ error: 'Account no longer exists' }, { status: 404 });
  }
  return NextResponse.json({ user: publicUser(user) });
}
