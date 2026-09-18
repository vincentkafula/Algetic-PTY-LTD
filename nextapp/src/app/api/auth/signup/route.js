const bcrypt = require('bcryptjs');
const crypto = require('crypto');
import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { issueToken, publicUser, isValidEmail, SELF_SERVICE_ROLES, DEFAULT_ROLE } = require('@/lib/authTokens');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * POST /api/auth/signup
 * body: { email, password, companyName, role }
 * Creates a customer account for this reseller platform. Each account's
 * mailboxes and phone numbers are private to that account.
 *
 * role is one of SELF_SERVICE_ROLES ('purchasing', 'email', 'mvno') —
 * deliberately NOT including 'admin'. Letting a public signup form grant
 * admin (cross-account visibility into every customer's data) would be a
 * real security hole, not a theoretical one — anyone could just register
 * and claim it. An admin account has to be created a different way (see
 * this repo's own operational docs, not a public API), not exposed here.
 */
async function POST_impl(request) {
  if (!process.env.JWT_SECRET) {
    return NextResponse.json({ error: 'Server is missing JWT_SECRET in .env' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { email, password, companyName, role } = body || {};

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }
  if (role !== undefined && !SELF_SERVICE_ROLES.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${SELF_SERVICE_ROLES.join(', ')}` }, { status: 400 });
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
    role: role || DEFAULT_ROLE,
    createdAt: new Date().toISOString()
  };
  await db.users.insert(user);

  return NextResponse.json({ token: issueToken(user), user: publicUser(user) }, { status: 201 });
}
export const POST = withSanitizedErrors(POST_impl);
