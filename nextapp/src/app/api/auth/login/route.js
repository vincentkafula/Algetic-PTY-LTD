const bcrypt = require('bcryptjs');
import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { issueToken, publicUser } = require('@/lib/authTokens');

/**
 * POST /api/auth/login
 * body: { email, password }
 */
export async function POST(request) {
  if (!process.env.JWT_SECRET) {
    return NextResponse.json({ error: 'Server is missing JWT_SECRET in .env' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { email, password } = body || {};
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
  }

  return NextResponse.json({ token: issueToken(user), user: publicUser(user) });
}
