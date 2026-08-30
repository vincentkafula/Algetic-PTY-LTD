const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

function isTwilioConfigured() {
  return Boolean(
    accountSid &&
    accountSid.startsWith('AC') &&
    accountSid !== 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' &&
    authToken &&
    authToken !== 'your_auth_token_here'
  );
}

const twilioClient = isTwilioConfigured() ? require('twilio')(accountSid, authToken) : null;

// Every route below requires a logged-in account; numbers are always
// scoped to req.user.id so one customer never sees another's data.
router.use(requireAuth);

/**
 * GET /api/numbers/search?country=US&areaCode=415
 * Searches for available numbers to provision.
 * Twilio country codes used here: US, CA, GB, ZA, ZM (see server/.env.example
 * for caveats on ZA's regulatory bundle requirement and ZM's unconfirmed
 * local-number availability).
 * CN (China) is not offered - see README "China" section for why.
 */
router.get('/search', async (req, res) => {
  const { country = 'US', areaCode } = req.query;
  const supported = (process.env.SUPPORTED_NUMBER_COUNTRIES || 'US,CA,GB').split(',');

  if (!supported.includes(country)) {
    return res.status(400).json({
      error: `Numbers for "${country}" are not offered by this platform yet.`,
      supportedCountries: supported
    });
  }
  if (!twilioClient) {
    return res.status(500).json({ error: 'Server is missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in .env' });
  }

  try {
    const opts = { limit: 10, voiceEnabled: true };
    if (areaCode) opts.areaCode = areaCode;
    const results = await twilioClient.availablePhoneNumbers(country).local.list(opts);
    res.json({
      country,
      results: results.map(r => ({
        friendlyName: r.friendlyName,
        phoneNumber: r.phoneNumber,
        locality: r.locality,
        region: r.region
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/numbers
 * List numbers provisioned by the logged-in account.
 */
router.get('/', (req, res) => {
  const provisioned = db.numbers.filter((n) => n.ownerId === req.user.id);
  res.json({ provisioned });
});

/**
 * POST /api/numbers/provision
 * body: { phoneNumber: "+14155551234", customerLabel: "Acme Support Line" }
 * Buys the number, then generates SIP trunk credentials the customer
 * enters into their IP phone / softphone.
 */
router.post('/provision', async (req, res) => {
  const { phoneNumber, customerLabel } = req.body || {};
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });
  if (!twilioClient) {
    return res.status(500).json({ error: 'Server is missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in .env' });
  }

  try {
    const bought = await twilioClient.incomingPhoneNumbers.create({ phoneNumber });

    // In production: create/attach a SIP Trunk + Credential List per customer
    // via twilioClient.trunking.v1.trunks.create(...) and issue each customer
    // their own SIP username/password scoped to their trunk, not a shared one.
    const record = {
      id: crypto.randomUUID(),
      ownerId: req.user.id,
      phoneNumber: bought.phoneNumber,
      twilioSid: bought.sid,
      customerLabel: customerLabel || null,
      provisionedAt: new Date().toISOString(),
      sipSetup: {
        note: 'Create a dedicated SIP Trunk per customer in production; this is a placeholder shape.',
        domain: 'your-subdomain.pstn.twilio.com',
        username: `cust_${bought.sid.slice(-8)}`,
        password: '(generate securely per-customer, never reuse)'
      }
    };
    await db.numbers.insert(record);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/numbers/:id
 * Releases the number back to Twilio (stops billing for it) and removes
 * the local record. Only the owning account can release its own number.
 */
router.delete('/:id', async (req, res) => {
  const record = db.numbers.find((n) => n.id === req.params.id && n.ownerId === req.user.id);
  if (!record) return res.status(404).json({ error: 'Number not found' });

  try {
    if (twilioClient && record.twilioSid) {
      await twilioClient.incomingPhoneNumbers(record.twilioSid).remove();
    }
  } catch (err) {
    // Non-fatal if Twilio-side release fails (e.g. already removed) — we
    // still remove the local record so the dashboard stays accurate.
    console.error('Failed to release Twilio number:', err.message);
  }

  await db.numbers.remove((n) => n.id === record.id);
  res.status(204).end();
});

module.exports = router;
