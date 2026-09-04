import { NextResponse } from 'next/server';

const twilio = require('twilio');
const db = require('@/lib/db');

const VoiceResponse = twilio.twiml.VoiceResponse;

// ---------------------------------------------------------------------------
// Ported from server/routes/teamCallingWebhooks.js. NOT behind requireAuth
// — Twilio calls this directly, same pattern as every other provider
// webhook: authenticity comes from verifying X-Twilio-Signature on every
// request, not from a session.
//
// Real Next.js-specific adaptations here, not a blind copy:
// - Express's req.headers['x-twilio-signature'] -> request.headers.get()
// - Express's req.get('host') + req.originalUrl (used to reconstruct the
//   exact URL Twilio signed) -> reconstructed from request.headers.get
//   ('host') + request.nextUrl.pathname + request.nextUrl.search
// - Express's req.query.member -> request.nextUrl.searchParams.get()
// - Form body (req.body.SipDomain, req.body.To) -> request.formData(),
//   same pattern as the PayFast ITN webhook in an earlier phase
// - This returns TwiML (XML), not JSON — NextResponse with an explicit
//   text/xml content type, not NextResponse.json()
//
// Two distinct call shapes land here:
//  1. A real PSTN caller dials a purchased number assigned to a team
//     member (POST .../team-voice?member=username) -> ring that
//     member's registered softphone.
//  2. Any SIP request that touches an account's Domain -> Twilio calls
//     this with no query string, passing SipDomain in the body. Two
//     cases inside this:
//       a. A registered member's softphone dialing OUT to a real phone
//          number (`To` looks like a phone number) -> bridge to the PSTN.
//       b. One SIP address dialing another directly -> bridge to that
//          username on the same domain.
// ---------------------------------------------------------------------------

function looksLikePhoneNumber(value) {
  return /^\+?[0-9]{7,15}$/.test(String(value || '').trim());
}

function xmlResponse(twiml) {
  return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
}

/**
 * POST /api/webhooks/twilio/team-voice
 */
export async function POST(request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = request.headers.get('x-twilio-signature');
  const formData = await request.formData().catch(() => null);
  const posted = formData ? Object.fromEntries(formData.entries()) : {};

  const url = `https://${request.headers.get('host')}${request.nextUrl.pathname}${request.nextUrl.search}`;
  const valid = authToken && signature && twilio.validateRequest(authToken, signature, url, posted);
  if (!valid) {
    return new NextResponse('Invalid Twilio signature', { status: 403, headers: { 'Content-Type': 'text/plain' } });
  }

  const twiml = new VoiceResponse();
  const memberFromQuery = request.nextUrl.searchParams.get('member');

  if (memberFromQuery) {
    // Shape 1: a real PSTN number assigned to ring this member.
    const number = db.numbers.find((n) => n.teamCallingMember === memberFromQuery);
    const domainRecord = number ? db.sipDomains.find((d) => d.ownerId === number.ownerId) : null;
    if (!domainRecord) {
      twiml.say('This number is not currently set up to receive calls. Goodbye.');
      twiml.hangup();
      return xmlResponse(twiml);
    }
    const dial = twiml.dial({ timeout: 25 });
    dial.sip(`sip:${memberFromQuery}@${domainRecord.domainName}`);
    twiml.say('That team member is not available right now. Goodbye.');
    return xmlResponse(twiml);
  }

  // Shape 2: a request that touched the account's Domain directly.
  const domainName = posted.SipDomain;
  const domainRecord = db.sipDomains.find((d) => d.domainName === domainName);
  const to = posted.To;

  if (!domainRecord) {
    twiml.say('This calling domain is not recognized. Goodbye.');
    twiml.hangup();
    return xmlResponse(twiml);
  }

  if (looksLikePhoneNumber(to)) {
    // A registered team member dialing out to a real phone number.
    // Twilio requires a valid caller ID for PSTN dial-out from a SIP
    // domain — using the account's first provisioned number if one
    // exists. If the account has no numbers yet, this call will fail at
    // Twilio's end with an invalid-caller-ID error, an honest
    // limitation rather than something silently papered over here.
    const callerNumber = db.numbers.find((n) => n.ownerId === domainRecord.ownerId);
    const dial = callerNumber ? twiml.dial({ callerId: callerNumber.phoneNumber }) : twiml.dial();
    dial.number(to);
  } else {
    // One team member's SIP address dialing another directly.
    const dial = twiml.dial({ timeout: 25 });
    dial.sip(`sip:${to}@${domainRecord.domainName}`);
    twiml.say('That team member is not available right now. Goodbye.');
  }

  return xmlResponse(twiml);
}
