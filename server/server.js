require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const mailboxRoutes = require('./routes/mailboxes');
const numberRoutes = require('./routes/numbers');
const webhookRoutes = require('./routes/webhooks');
const { isMailgunConfigured, isInboundCaptureConfigured } = require('./mailgunClient');
const { isTwilioConfigured } = require('./twilioClient');

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
// Not behind requireAuth — Mailgun calls this directly. Authenticity comes
// from verifying Mailgun's own signature inside the route, not a session.
app.use('/api/webhooks', webhookRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    jwtConfigured: Boolean(process.env.JWT_SECRET),
    mailgunConfigured: isMailgunConfigured(),
    mailgunInboundCaptureConfigured: isInboundCaptureConfigured(),
    twilioConfigured: isTwilioConfigured(),
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
