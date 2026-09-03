const express = require('express');
const router = express.Router();

const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isTwilioConfigured, twilioClient } = require('../twilioClient');
const { PUBLIC_BASE_URL } = require('../mailgunClient');
const sipDomain = require('../services/sipDomain');

// ---------------------------------------------------------------------------
// Team calling: a real Twilio SIP Domain per account, replacing the
// self-hosted Kamailio/rtpengine system entirely. See services/sipDomain.js
// for the "why" — this file is thin, mostly translating HTTP <-> that
// service, plus the number-to-member assignment (mutually exclusive with
// SIP trunking and Call Centre assignment, same one-job-per-number rule
// already established for numbers in routes/callCentre.js).
// ---------------------------------------------------------------------------

function isConfigured() {
  return isTwilioConfigured() && Boolean(PUBLIC_BASE_URL);
}

router.use(requireAuth);

/**
 * GET /api/team-calling/domain
 * Returns (creating on first call) this account's SIP Domain name —
 * what a softphone registers to, as username@domainName.
 */
router.get('/domain', async (req, res) => {
  if (!isConfigured()) {
    return res.status(500).json({ error: 'Server is missing Twilio configuration or PUBLIC_BASE_URL in .env' });
  }
  try {
    const record = await sipDomain.ensureDomainForAccount(req.user.id);
    res.json(sipDomain.publicDomain(record));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /api/team-calling/members
 */
router.get('/members', async (req, res) => {
  if (!isConfigured()) {
    return res.status(500).json({ error: 'Server is missing Twilio configuration or PUBLIC_BASE_URL in .env' });
  }
  try {
    const result = await sipDomain.listMembers(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /api/team-calling/members
 * body: { username, password }
 * Adds a member, or resets their password if the username already
 * exists — see services/sipDomain.js for why those share one path.
 * Password is supplied by the caller (not generated), same as the
 * self-hosted system this replaces, so the dashboard UI here is
 * unchanged from what it used to be.
 */
router.post('/members', async (req, res) => {
  if (!isConfigured()) {
    return res.status(500).json({ error: 'Server is missing Twilio configuration or PUBLIC_BASE_URL in .env' });
  }
  const { username, password } = req.body || {};
  if (!username || !password || password.length < 8) {
    return res.status(400).json({ error: 'username and a password (min 8 characters) are required' });
  }
  try {
    const result = await sipDomain.addOrResetMember(req.user.id, username, password);
    const domainRecord = await sipDomain.ensureDomainForAccount(req.user.id);
    res.status(201).json({ ...result, domainName: domainRecord.domainName });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * DELETE /api/team-calling/members/:username
 */
router.delete('/members/:username', async (req, res) => {
  if (!isConfigured()) {
    return res.status(500).json({ error: 'Server is missing Twilio configuration or PUBLIC_BASE_URL in .env' });
  }
  try {
    await sipDomain.removeMember(req.user.id, req.params.username);
    res.status(204).end();
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /api/team-calling/numbers/:numberId/assign
 * body: { username }
 * Points a purchased phone number's Voice URL at this account's team
 * member, so calling that real, public number rings the member's
 * registered softphone — this is the actual "reachable from the public
 * phone network" part. Detaches the number from any SIP trunk or Call
 * Centre menu it was on first, same mutual-exclusivity rule as the rest
 * of the numbers feature.
 */
router.post('/numbers/:numberId/assign', async (req, res) => {
  const number = db.numbers.find((n) => n.id === req.params.numberId && n.ownerId === req.user.id);
  if (!number) return res.status(404).json({ error: 'Number not found' });
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username is required' });
  if (!isConfigured()) {
    return res.status(500).json({ error: 'Server is missing Twilio configuration or PUBLIC_BASE_URL in .env' });
  }

  try {
    const { members } = await sipDomain.listMembers(req.user.id);
    if (!members.includes(username)) {
      return res.status(400).json({ error: 'username does not match one of your team members' });
    }

    if (number.trunkId) {
      const trunk = db.trunks.find((t) => t.id === number.trunkId);
      if (trunk) {
        try {
          await twilioClient.trunking.v1.trunks(trunk.trunkSid).phoneNumbers(number.twilioSid).remove();
        } catch (err) {
          console.error('Failed to detach number from trunk before team-calling assignment:', err.message);
        }
      }
    }
    if (number.callCentreMenuId) {
      await twilioClient.incomingPhoneNumbers(number.twilioSid).update({ voiceUrl: '' });
    }

    const voiceUrl = `${PUBLIC_BASE_URL}/api/webhooks/twilio/team-voice?member=${encodeURIComponent(username)}`;
    await twilioClient.incomingPhoneNumbers(number.twilioSid).update({ voiceUrl, voiceMethod: 'POST' });

    const updated = await db.numbers.update(
      (n) => n.id === number.id,
      { teamCallingMember: username, trunkId: null, callCentreMenuId: null }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/team-calling/numbers/:numberId/unassign
 */
router.post('/numbers/:numberId/unassign', async (req, res) => {
  const number = db.numbers.find((n) => n.id === req.params.numberId && n.ownerId === req.user.id);
  if (!number) return res.status(404).json({ error: 'Number not found' });
  if (!isConfigured()) {
    return res.status(500).json({ error: 'Server is missing Twilio configuration in .env' });
  }
  try {
    await twilioClient.incomingPhoneNumbers(number.twilioSid).update({ voiceUrl: '' });
    const updated = await db.numbers.update((n) => n.id === number.id, { teamCallingMember: null });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
