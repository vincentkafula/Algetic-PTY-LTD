require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const mailboxRoutes = require('./routes/mailboxes');
const numberRoutes = require('./routes/numbers');

const app = express();
app.use(cors());
app.use(express.json());

// Basic request logging — replace with a real logger (pino/winston) + request
// IDs before running this in production.
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/mailboxes', mailboxRoutes);
app.use('/api/numbers', numberRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    jwtConfigured: Boolean(process.env.JWT_SECRET),
    mailgunConfigured: Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_API_KEY !== 'key-xxxxxxxxxxxxxxxxxxxxxxxx'),
    twilioConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith('AC') && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_AUTH_TOKEN !== 'your_auth_token_here'),
    supportedCountries: (process.env.SUPPORTED_NUMBER_COUNTRIES || 'US,CA,GB').split(',')
  });
});

// Serve the static dashboard/landing frontend.
// This lives at server/public (not a sibling ../public) so it's included
// when a host's build is scoped to the server/ directory (e.g. Railway's
// "root directory" setting) — a sibling folder outside that root would be
// left out of the build entirely, which is what caused earlier 404s.
app.use(express.static(path.join(__dirname, 'public')));

// JSON error handler for anything that slips past individual routes
// (e.g. malformed JSON bodies), so clients always get JSON back, not an
// HTML stack trace.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Unexpected server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`CommHub server running on http://localhost:${PORT}`);
  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET is not set — signup/login will fail. Set one in server/.env.');
  }
  console.log('Fill in server/.env from server/.env.example before going live.');
});
