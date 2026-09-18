const jwt = require('jsonwebtoken');

// Shared by signup and login route handlers — split into separate files by
// Next.js's file-based routing (app/api/auth/signup/route.js, .../login/
// route.js), unlike the original Express version where both lived in one
// routes/auth.js and could share local functions directly.

const TOKEN_TTL = '7d';

// The set of roles an account can be granted. 'admin' is deliberately
// listed here (requireRole checks against it) but is NOT included in
// SELF_SERVICE_ROLES — see signup/route.js for why it can't be chosen at
// public signup.
const ALL_ROLES = ['purchasing', 'email', 'mvno', 'admin'];
const SELF_SERVICE_ROLES = ['purchasing', 'email', 'mvno'];
const DEFAULT_ROLE = 'purchasing';

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, typ: 'account', role: user.role || DEFAULT_ROLE }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function publicUser(user) {
  return { id: user.id, email: user.email, companyName: user.companyName || null, role: user.role || DEFAULT_ROLE, createdAt: user.createdAt };
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = { issueToken, publicUser, isValidEmail, ALL_ROLES, SELF_SERVICE_ROLES, DEFAULT_ROLE };
