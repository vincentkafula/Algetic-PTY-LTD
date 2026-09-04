const bcrypt = require('bcryptjs');
const crypto = require('crypto');
import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { issueToken, publicUser, isValidEmail } = require('@/lib/authTokens');

/**
 * POST /api/auth/signup
 * body: { email, password, companyName }
 * Creates a customer account for this reseller platform. Each account's
 * mailboxes and phone numbers are private to that account.
 */
export async function POST(request) {
  if (!process.env.JWT_SECRET) {
    return NextResponse.json({ error: 'Server is missing JWT_SECRET in .env' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { email, password, companyName } = body || {};

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: crypto.randomUUID(),
    email,
    passwordHash,
    companyName: companyName || null,
    createdAt: new Date().toISOString()
  };
  await db.users.insert(user);

  return NextResponse.json({ token: issueToken(user), user: publicUser(user) }, { status: 201 });
}
