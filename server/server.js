require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const mailboxRoutes = require('./routes/mailboxes');
const webmailRoutes = require('./routes/webmail');
const numberRoutes = require('./routes/numbers');
const webhookRoutes = require('./routes/webhooks');
const teamCallingRoutes = require('./routes/teamCalling');
const teamCallingWebhookRoutes = require('./routes/teamCallingWebhooks');
const callCentreRoutes = require('./routes/callCentre');
const callCentreWebhookRoutes = require('./routes/callCentreWebhooks');
const domainRoutes = require('./routes/domains');
const projectRoutes = require('./routes/projects');
const mvnoRoutes = require('./routes/mvno');
const paymentRoutes = require('./routes/payments');
const paymentWebhookRoutes = require('./routes/paymentWebhooks');
const { isMailgunConfigured, isInboundCaptureConfigured, PUBLIC_BASE_URL } = require('./mailgunClient');
const { isConfigured: isPayfastConfigured } = require('./services/payfast');
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
app.use('/api/webmail', webmailRoutes);
app.use('/api/numbers', numberRoutes);
app.use('/api/team-calling', teamCallingRoutes);
app.use('/api/call-centre', callCentreRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/mvno', mvnoRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks/payfast', paymentWebhookRoutes);
// Not behind requireAuth — Twilio calls these directly. Authenticity comes
// from verifying Twilio's own X-Twilio-Signature header inside each route.
app.use('/api/webhooks/twilio', callCentreWebhookRoutes);
app.use('/api/webhooks/twilio', teamCallingWebhookRoutes);
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
    teamCallingConfigured: isTwilioConfigured() && Boolean(PUBLIC_BASE_URL),
    callCentreConfigured: isTwilioConfigured() && Boolean(PUBLIC_BASE_URL),
    domainsConfigured: isGoDaddyConfigured(),
    paymentsConfigured: isPayfastConfigured() && Boolean(PUBLIC_BASE_URL),
    supportedCountries: (process.env.SUPPORTED_NUMBER_COUNTRIES || 'US,CA,GB').split(',')
  });
});

// Serve the built React frontend (built by `npm run build` in frontend/,
// output straight into server/public — see server/package.json's build
// script). This lives at server/public (not a sibling ../public) so it's
// included when a host's build is scoped to the server/ directory (e.g.
// Railway's "root directory" setting) — a sibling folder outside that
// root would be left out of the build entirely, which is what caused
// earlier 404s.
app.use(express.static(path.join(__dirname, 'public')));

// Anything under /api/* that reached here didn't match any router above —
// respond with a proper JSON 404, not the SPA shell below, so API
// clients get a sane error instead of an HTML page.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// SPA fallback: React Router owns client-side routing (/, /login,
// /dashboard, /webmail-login, /webmail), but the server still needs to
// hand back index.html for a direct link or a hard refresh on any of
// those paths — otherwise Express would 404 on a URL React Router would
// have handled fine via client-side navigation. Must come after
// express.static and the /api 404 handler above, so real static files
// (JS/CSS bundles, favicon) and real API 404s aren't swallowed by this
// catch-all.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
