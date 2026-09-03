const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();

const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '7d';

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, typ: 'account' }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function publicUser(user) {
  return { id: user.id, email: user.email, companyName: user.companyName || null, createdAt: user.createdAt };
}

/**
 * POST /api/auth/signup
 * body: { email, password, companyName }
 * Creates a customer account for this reseller platform. Each account's
 * mailboxes and phone numbers are private to that account.
 */
router.post('/signup', async (req, res) => {
  if (!JWT_SECRET) return res.status(500).json({ error: 'Server is missing JWT_SECRET in .env' });

  const { email, password, companyName } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: crypto.randomUUID(),
    email,
    passwordHash,
    companyName: companyName || null,
    createdAt: new Date().toISOString()
  };
  await db.users.insert(user);

  res.status(201).json({ token: issueToken(user), user: publicUser(user) });
});

/**
 * POST /api/auth/login
 * body: { email, password }
 */
router.post('/login', async (req, res) => {
  if (!JWT_SECRET) return res.status(500).json({ error: 'Server is missing JWT_SECRET in .env' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return res.status(401).json({ error: 'Incorrect email or password' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password' });

  res.json({ token: issueToken(user), user: publicUser(user) });
});

/**
 * GET /api/auth/me
 * Returns the logged-in account, so the dashboard can confirm the token
 * is still valid and show who's signed in.
 */
router.get('/me', requireAuth, (req, res) => {
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Account no longer exists' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
