const jwt = require('jsonwebtoken');

// Shared by signup and login route handlers — split into separate files by
// Next.js's file-based routing (app/api/auth/signup/route.js, .../login/
// route.js), unlike the original Express version where both lived in one
// routes/auth.js and could share local functions directly.

const TOKEN_TTL = '7d';

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, typ: 'account' }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function publicUser(user) {
  return { id: user.id, email: user.email, companyName: user.companyName || null, createdAt: user.createdAt };
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = { issueToken, publicUser, isValidEmail };
