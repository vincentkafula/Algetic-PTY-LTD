require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const mailboxRoutes = require('./routes/mailboxes');
const numberRoutes = require('./routes/numbers');
const webhookRoutes = require('./routes/webhooks');
const sipNetworkRoutes = require('./routes/sipNetwork');
const callCentreRoutes = require('./routes/callCentre');
const callCentreWebhookRoutes = require('./routes/callCentreWebhooks');
const domainRoutes = require('./routes/domains');
const projectRoutes = require('./routes/projects');
const mvnoRoutes = require('./routes/mvno');
const { isMailgunConfigured, isInboundCaptureConfigured, PUBLIC_BASE_URL } = require('./mailgunClient');
const { isTwilioConfigured } = require('./twilioClient');
const { isGoDaddyConfigured } = require('./godaddyClient');

const app = express();
app.use(cors());
app.use(express.json());
// Twilio's webhooks POST application/x-www-form-urlencoded, not JSON —
// needed for callCentreWebhooks.js to read req.body at all (and for
// twilio.validateRequest to see the exact params Twilio signed).
app.use(express.urlencoded({ extended: false }));

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
app.use('/api/sip-network', sipNetworkRoutes);
app.use('/api/call-centre', callCentreRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/mvno', mvnoRoutes);
// Not behind requireAuth — Twilio calls this directly. Authenticity comes
// from verifying Twilio's own X-Twilio-Signature header inside the route.
app.use('/api/webhooks/twilio', callCentreWebhookRoutes);
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
    sipNetworkConfigured: Boolean(process.env.SIP_NETWORK_API_URL && process.env.SIP_NETWORK_API_KEY),
    callCentreConfigured: isTwilioConfigured() && Boolean(PUBLIC_BASE_URL),
    domainsConfigured: isGoDaddyConfigured(),
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
  console.log(`Altegic server running on http://localhost:${PORT}`);
  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET is not set — signup/login will fail. Set one in server/.env.');
  }
  console.log('Fill in server/.env from server/.env.example before going live.');
});
