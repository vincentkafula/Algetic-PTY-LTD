import { NextResponse } from 'next/server';

const twilio = require('twilio');
const db = require('./db');
const { twilioClient, isTwilioConfigured } = require('./twilioClient');

const VoiceResponse = twilio.twiml.VoiceResponse;

// ---------------------------------------------------------------------------
// Shared by the three call-centre voice webhook Route Handlers (voice,
// gather, agent-connect) — split apart by Next.js's file-based routing,
// unlike Express where these all lived in one routes/callCentreWebhooks.js
// and could share local functions directly. Same reasoning as
// domainOwnership.js in an earlier phase.
//
// NOT behind requireAuth — Twilio calls these directly for both inbound
// calls to an Altegic number and outbound legs Altegic itself placed (to
// ring agents). Authenticity comes from verifying Twilio's own
// X-Twilio-Signature header on every request.
// ---------------------------------------------------------------------------

/**
 * Verifies a request's Twilio signature. Real Next.js-specific adaptation
 * versus the Express version: URL reconstruction uses request.headers.get
 * ('host') + request.nextUrl.pathname + request.nextUrl.search instead of
 * Express's req.get('host') + req.originalUrl. Explicitly built as
 * https:// rather than trusted from the request, same reasoning as the
 * Express version — Railway (and most PaaS platforms) terminate TLS
 * before the request reaches this process, and Twilio always signed
 * against the https:// URL it was actually configured with.
 */
function verifyTwilioSignature(request, postedParams) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  const signature = request.headers.get('x-twilio-signature');
  if (!signature) return false;
  const url = `https://${request.headers.get('host')}${request.nextUrl.pathname}${request.nextUrl.search}`;
  return twilio.validateRequest(authToken, signature, url, postedParams);
}

function rejectUnsigned() {
  return new NextResponse('Invalid Twilio signature', { status: 403, headers: { 'Content-Type': 'text/plain' } });
}

function xmlResponse(twiml) {
  return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
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
    action: `${process.env.PUBLIC_BASE_URL}/api/webhooks/twilio/gather?menuId=${menu.id}`,
    method: 'POST',
    timeout: 8
  });
  gather.say(menu.greeting);
  twiml.say('We did not receive any input. Goodbye.');
  twiml.hangup();
  return twiml;
}

/**
 * Places an outbound call to every available agent on this queue, each
 * one landing on /agent-connect when answered. Twilio's <Dial><Queue>
 * only has one waiting caller to bridge to, so only one agent leg
 * actually connects — the rest hit the agent-connect timeout and hang up
 * gracefully. This specific flow has NOT been tested against live calls
 * (same honest limitation as the Express version) — placing real phone
 * calls isn't possible from a development sandbox, only reasoned through
 * against Twilio's official documented pattern for this.
 */
async function notifyAgents(queue, fromNumber) {
  if (!isTwilioConfigured() || !process.env.PUBLIC_BASE_URL) return;
  const agents = db.callAgents.filter((a) => a.queueId === queue.id && a.available);
  await Promise.all(
    agents.map((agent) =>
      twilioClient.calls.create({
        to: agent.phoneNumber,
        from: fromNumber,
        url: `${process.env.PUBLIC_BASE_URL}/api/webhooks/twilio/agent-connect?queueId=${queue.id}`,
        method: 'POST'
      })
    )
  );
}

module.exports = { verifyTwilioSignature, rejectUnsigned, xmlResponse, buildMenuTwiml, notifyAgents, VoiceResponse };
