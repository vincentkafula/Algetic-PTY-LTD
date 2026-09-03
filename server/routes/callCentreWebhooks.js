const express = require('express');
const twilio = require('twilio');
const router = express.Router();

const db = require('../db');
const { twilioClient, isTwilioConfigured } = require('../twilioClient');
const { PUBLIC_BASE_URL } = require('../mailgunClient');

const VoiceResponse = twilio.twiml.VoiceResponse;

// ---------------------------------------------------------------------------
// NOT behind requireAuth — Twilio calls these directly for both inbound
// calls to a Altegic number and outbound legs Altegic itself placed (to
// ring agents). Authenticity comes from verifying Twilio's own
// X-Twilio-Signature header on every request, the same pattern used for
// Mailgun's inbound webhook (routes/webhooks.js) — different provider,
// same principle: never trust an unauthenticated endpoint without
// verifying who actually sent the request.
//
// The menuId/queueId values in these URLs are not attacker-controlled: a
// caller dialing in can only send DTMF digits, not rewrite the webhook
// URL Twilio was configured to call — that URL was set by this app itself
// when the number was assigned to a menu (see routes/callCentre.js).
// ---------------------------------------------------------------------------

function verifyTwilioSignature(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  const signature = req.headers['x-twilio-signature'];
  if (!signature) return false;
  // Reconstructed explicitly as https:// rather than trusted from
  // req.protocol — Railway (and most PaaS platforms) terminate TLS before
  // the request reaches this process, so req.protocol reports "http"
  // unless "trust proxy" is set, and Twilio always signed against the
  // https:// URL it was actually configured with.
  const url = `https://${req.get('host')}${req.originalUrl}`;
  return twilio.validateRequest(authToken, signature, url, req.body);
}

function rejectUnsigned(res) {
  res.status(403).type('text/plain').send('Invalid Twilio signature');
}

/**
 * Builds the "ask a question, wait for a digit" TwiML for a given menu.
 * Shared between the initial call and submenu navigation (a "menu"-type
 * option just re-runs this for a different menu id).
 */
function buildMenuTwiml(menu) {
  const twiml = new VoiceResponse();
  const gather = twiml.gather({
    numDigits: 1,
    action: `${PUBLIC_BASE_URL}/api/webhooks/twilio/gather?menuId=${menu.id}`,
    method: 'POST',
    timeout: 8
  });
  gather.say(menu.greeting);
  twiml.say('We did not receive any input. Goodbye.');
  twiml.hangup();
  return twiml;
}

/**
 * POST /api/webhooks/twilio/voice?menuId=<id>
 * Entry point when someone calls a number assigned to a menu.
 */
router.post('/voice', (req, res) => {
  if (!verifyTwilioSignature(req)) return rejectUnsigned(res);

  const menu = db.ivrMenus.find((m) => m.id === req.query.menuId);
  if (!menu) {
    const twiml = new VoiceResponse();
    twiml.say('This number is not currently configured. Goodbye.');
    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }

  res.type('text/xml').send(buildMenuTwiml(menu).toString());
});

/**
 * POST /api/webhooks/twilio/gather?menuId=<id>
 * Twilio posts the caller's pressed digit here (as "Digits").
 */
router.post('/gather', async (req, res) => {
  if (!verifyTwilioSignature(req)) return rejectUnsigned(res);

  const menu = db.ivrMenus.find((m) => m.id === req.query.menuId);
  if (!menu) {
    const twiml = new VoiceResponse();
    twiml.say('This number is not currently configured. Goodbye.');
    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }

  const digit = req.body.Digits;
  const option = (menu.options || []).find((o) => o.digit === digit);

  if (!option) {
    const twiml = new VoiceResponse();
    twiml.say('Sorry, that is not a valid option.');
    twiml.redirect({ method: 'POST' }, `${PUBLIC_BASE_URL}/api/webhooks/twilio/voice?menuId=${menu.id}`);
    return res.type('text/xml').send(twiml.toString());
  }

  if (option.action === 'menu') {
    const submenu = db.ivrMenus.find((m) => m.id === option.target && m.ownerId === menu.ownerId);
    if (!submenu) {
      const twiml = new VoiceResponse();
      twiml.say('That menu is no longer available. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }
    return res.type('text/xml').send(buildMenuTwiml(submenu).toString());
  }

  if (option.action === 'dial') {
    const twiml = new VoiceResponse();
    twiml.dial(option.target);
    return res.type('text/xml').send(twiml.toString());
  }

  if (option.action === 'hangup') {
    const twiml = new VoiceResponse();
    if (option.target) twiml.say(option.target);
    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }

  if (option.action === 'queue') {
    const queue = db.callQueues.find((q) => q.id === option.target && q.ownerId === menu.ownerId);
    if (!queue) {
      const twiml = new VoiceResponse();
      twiml.say('That department is not available right now. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    const twiml = new VoiceResponse();
    // No waitUrl specified — Twilio plays its own default hold music,
    // which keeps this simpler and gives one less unauthenticated webhook
    // to secure and maintain for what's a non-critical cosmetic feature.
    twiml.enqueue(queue.twilioQueueName);
    res.type('text/xml').send(twiml.toString());

    // Ring available agents AFTER responding to Twilio's gather request —
    // the caller shouldn't wait on this before hearing hold music start.
    notifyAgents(queue, req.body.To).catch((err) => {
      console.error('Failed to notify agents for queue', queue.id, err.message);
    });
    return;
  }
});

/**
 * POST /api/webhooks/twilio/agent-connect?queueId=<id>
 * TwiML fetched when an agent answers the outbound call Altegic placed to
 * ring them — bridges them to the oldest waiting caller in the queue.
 */
router.post('/agent-connect', (req, res) => {
  if (!verifyTwilioSignature(req)) return rejectUnsigned(res);

  const queue = db.callQueues.find((q) => q.id === req.query.queueId);
  const twiml = new VoiceResponse();
  if (!queue) {
    twiml.say('This queue is no longer available. Goodbye.');
    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }

  twiml.say('Connecting you now.');
  // timeout caps how long this agent leg waits if it loses the race to
  // another agent leg for the same (single) waiting caller — without it,
  // an agent who isn't first to answer would otherwise be left holding
  // silently until Twilio's own much longer default timeout.
  const dial = twiml.dial({ timeout: 15 });
  dial.queue(queue.twilioQueueName);
  res.type('text/xml').send(twiml.toString());
});

/**
 * Places an outbound call to every available agent on this queue, each
 * one landing on /agent-connect when answered. Twilio's <Dial><Queue> only
 * has one waiting caller to bridge to, so only one agent leg actually
 * connects — the rest hit the timeout above and hang up gracefully. This
 * is Twilio's own documented pattern for ring-multiple-agents queueing
 * (see this project's README for what's been verified vs not — this
 * specific flow has NOT been tested against live calls, only reasoned
 * through against Twilio's official docs, since placing real phone calls
 * isn't possible from a development sandbox).
 */
async function notifyAgents(queue, fromNumber) {
  if (!isTwilioConfigured() || !PUBLIC_BASE_URL) return;
  const agents = db.callAgents.filter((a) => a.queueId === queue.id && a.available);
  await Promise.all(
    agents.map((agent) =>
      twilioClient.calls.create({
        to: agent.phoneNumber,
        from: fromNumber,
        url: `${PUBLIC_BASE_URL}/api/webhooks/twilio/agent-connect?queueId=${queue.id}`,
        method: 'POST'
      })
    )
  );
}

module.exports = router;
