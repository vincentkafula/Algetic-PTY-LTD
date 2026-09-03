const express = require('express');
const twilio = require('twilio');
const router = express.Router();

const db = require('../db');
const { PUBLIC_BASE_URL } = require('../mailgunClient');

const VoiceResponse = twilio.twiml.VoiceResponse;

// ---------------------------------------------------------------------------
// NOT behind requireAuth — Twilio calls these directly, same pattern and
// same reasoning as callCentreWebhooks.js: authenticity comes from
// verifying X-Twilio-Signature on every request, not from a session.
//
// Two distinct call shapes land here:
//  1. A real PSTN caller dials a purchased number assigned to a team
//     member (POST .../team-voice?member=username, set by
//     routes/teamCalling.js's assign endpoint) -> ring that member's
//     registered softphone.
//  2. Any SIP request that touches an account's Domain -> Twilio calls
//     this with no query string, and passes SipDomain in the body so we
//     can identify which account this belongs to (every Altegic account
//     shares one Twilio account, so the domain name is the only thing
//     that disambiguates whose call this is). Two cases inside this:
//       a. A registered member's softphone dialing OUT to a real phone
//          number (`To` looks like a phone number) -> bridge to the PSTN.
//       b. One SIP address dialing another directly (`To` looks like a
//          username, not a number) -> bridge to that username on the
//          same domain, team-member-to-team-member calling with no
//          phone number involved at all.
// ---------------------------------------------------------------------------

function verifyTwilioSignature(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  const signature = req.headers['x-twilio-signature'];
  if (!signature) return false;
  const url = `https://${req.get('host')}${req.originalUrl}`;
  return twilio.validateRequest(authToken, signature, url, req.body);
}

function rejectUnsigned(res) {
  res.status(403).type('text/plain').send('Invalid Twilio signature');
}

function looksLikePhoneNumber(value) {
  return /^\+?[0-9]{7,15}$/.test(String(value || '').trim());
}

/**
 * POST /api/webhooks/twilio/team-voice
 * Handles both shapes described above.
 */
router.post('/team-voice', (req, res) => {
  if (!verifyTwilioSignature(req)) return rejectUnsigned(res);

  const twiml = new VoiceResponse();
  const memberFromQuery = req.query.member;

  if (memberFromQuery) {
    // Shape 1: a real PSTN number assigned to ring this member.
    const number = db.numbers.find((n) => n.teamCallingMember === memberFromQuery);
    const domainRecord = number ? db.sipDomains.find((d) => d.ownerId === number.ownerId) : null;
    if (!domainRecord) {
      twiml.say('This number is not currently set up to receive calls. Goodbye.');
      twiml.hangup();
      res.type('text/xml').send(twiml.toString());
      return;
    }
    const dial = twiml.dial({ timeout: 25 });
    dial.sip(`sip:${memberFromQuery}@${domainRecord.domainName}`);
    twiml.say('That team member is not available right now. Goodbye.');
    res.type('text/xml').send(twiml.toString());
    return;
  }

  // Shape 2: a request that touched the account's Domain directly.
  const domainName = req.body.SipDomain;
  const domainRecord = db.sipDomains.find((d) => d.domainName === domainName);
  const to = req.body.To;

  if (!domainRecord) {
    twiml.say('This calling domain is not recognized. Goodbye.');
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
    return;
  }

  if (looksLikePhoneNumber(to)) {
    // A registered team member dialing out to a real phone number.
    // Twilio requires a valid caller ID for PSTN dial-out from a SIP
    // domain — using the account's first provisioned number if one
    // exists. If the account has no numbers yet, this call will fail at
    // Twilio's end with an invalid-caller-ID error, which is an honest
    // limitation (documented in README) rather than something silently
    // papered over here.
    const callerNumber = db.numbers.find((n) => n.ownerId === domainRecord.ownerId);
    const dial = callerNumber ? twiml.dial({ callerId: callerNumber.phoneNumber }) : twiml.dial();
    dial.number(to);
  } else {
    // One team member's SIP address dialing another directly.
    const dial = twiml.dial({ timeout: 25 });
    dial.sip(`sip:${to}@${domainRecord.domainName}`);
    twiml.say('That team member is not available right now. Goodbye.');
  }

  res.type('text/xml').send(twiml.toString());
});

module.exports = router;
