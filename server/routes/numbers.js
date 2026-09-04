const express = require('express');
const router = express.Router();

const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { twilioClient, isTwilioConfigured } = require('../twilioClient');
const trunking = require('../services/trunking');
const { getMonthlyNumberCostUsdCents } = require('../services/twilioPricing');
const { createOrderWithCheckout } = require('../services/orders');

// Every route below requires a logged-in account; numbers and trunks are
// always scoped to req.user.id so one customer never sees another's data.
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
  if (!isTwilioConfigured()) {
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
 * GET /api/numbers/trunk
 * Returns the account's SIP trunk info (never the password — see the
 * trunking service for why). 404 if no number has been provisioned yet,
 * since a trunk is created lazily on first provision.
 */
router.get('/trunk', (req, res) => {
  const record = db.trunks.find((t) => t.ownerId === req.user.id);
  if (!record) return res.status(404).json({ error: 'No trunk yet — provision a number first' });
  res.json({ trunk: trunking.publicTrunk(record) });
});

/**
 * POST /api/numbers/trunk/origination
 * body: { sipUri: "sip:203.0.113.10:5060" }
 * Sets where inbound calls to this account's numbers are delivered — the
 * customer's own PBX/SBC/softphone public SIP address. Required reading:
 * this is NOT "enter your softphone's registration details" — Twilio
 * Elastic SIP Trunking cannot accept a device that isn't reachable at a
 * fixed address. See services/trunking.js for the fuller explanation.
 */
router.post('/trunk/origination', async (req, res) => {
  const { sipUri } = req.body || {};
  if (!sipUri) return res.status(400).json({ error: 'sipUri is required, e.g. sip:203.0.113.10:5060' });

  try {
    const updated = await trunking.setOriginationUri(req.user.id, sipUri);
    res.json({ trunk: trunking.publicTrunk(updated) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /api/numbers/trunk/reset-password
 * Regenerates the account's SIP credential. Returns the new password once
 * — it cannot be retrieved again after this response, by design.
 */
router.post('/trunk/reset-password', async (req, res) => {
  try {
    const { record, generatedPassword } = await trunking.resetCredential(req.user.id);
    res.json({ trunk: trunking.publicTrunk(record), password: generatedPassword });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /api/numbers/provision
 * body: { phoneNumber: "+14155551234", customerLabel: "Acme Support Line" }
 * Buys the number, ensures the account has its own dedicated SIP trunk
 * (creating one on first use), attaches the number to it, and returns the
 * real SIP domain + username. The password is only included in the
 * response the first time a trunk is created for this account — after
 * that, existing numbers share the same trunk/credential, and the
 * password can only be seen again via trunk/reset-password.
 */
router.post('/provision', async (req, res) => {
  const { phoneNumber, country, customerLabel } = req.body || {};
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });
  if (!country) return res.status(400).json({ error: 'country is required' });
  if (!isTwilioConfigured()) {
    return res.status(500).json({ error: 'Server is missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in .env' });
  }

  try {
    const baseUsdCents = await getMonthlyNumberCostUsdCents(country);
    const result = await createOrderWithCheckout({
      ownerId: req.user.id,
      ownerEmail: req.user.email,
      fulfillmentType: 'number',
      fulfillmentData: { phoneNumber, customerLabel: customerLabel || null },
      baseUsdCents,
      itemName: phoneNumber,
      itemDescription: `Phone number: ${phoneNumber} (first month)`
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * DELETE /api/numbers/:id
 * Releases the number back to Twilio (stops billing for it) and removes
 * the local record. Only the owning account can release its own number.
 * The account's trunk itself is left in place, since it may still hold
 * other numbers.
 */
router.delete('/:id', async (req, res) => {
  const record = db.numbers.find((n) => n.id === req.params.id && n.ownerId === req.user.id);
  if (!record) return res.status(404).json({ error: 'Number not found' });

  try {
    if (isTwilioConfigured() && record.twilioSid) {
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
