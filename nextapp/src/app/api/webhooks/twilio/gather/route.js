const db = require('@/lib/db');
const { verifyTwilioSignature, rejectUnsigned, xmlResponse, buildMenuTwiml, notifyAgents, VoiceResponse } = require('@/lib/callCentreVoice');

/**
 * POST /api/webhooks/twilio/gather?menuId=<id>
 * Twilio posts the caller's pressed digit here (as "Digits").
 */
export async function POST(request) {
  const formData = await request.formData().catch(() => null);
  const posted = formData ? Object.fromEntries(formData.entries()) : {};

  if (!verifyTwilioSignature(request, posted)) return rejectUnsigned();

  const menuId = request.nextUrl.searchParams.get('menuId');
  const menu = db.ivrMenus.find((m) => m.id === menuId);
  if (!menu) {
    const twiml = new VoiceResponse();
    twiml.say('This number is not currently configured. Goodbye.');
    twiml.hangup();
    return xmlResponse(twiml);
  }

  const digit = posted.Digits;
  const option = (menu.options || []).find((o) => o.digit === digit);

  if (!option) {
    const twiml = new VoiceResponse();
    twiml.say('Sorry, that is not a valid option.');
    twiml.redirect({ method: 'POST' }, `${process.env.PUBLIC_BASE_URL}/api/webhooks/twilio/voice?menuId=${menu.id}`);
    return xmlResponse(twiml);
  }

  if (option.action === 'menu') {
    const submenu = db.ivrMenus.find((m) => m.id === option.target && m.ownerId === menu.ownerId);
    if (!submenu) {
      const twiml = new VoiceResponse();
      twiml.say('That menu is no longer available. Goodbye.');
      twiml.hangup();
      return xmlResponse(twiml);
    }
    return xmlResponse(buildMenuTwiml(submenu));
  }

  if (option.action === 'dial') {
    const twiml = new VoiceResponse();
    twiml.dial(option.target);
    return xmlResponse(twiml);
  }

  if (option.action === 'hangup') {
    const twiml = new VoiceResponse();
    if (option.target) twiml.say(option.target);
    twiml.hangup();
    return xmlResponse(twiml);
  }

  if (option.action === 'queue') {
    const queue = db.callQueues.find((q) => q.id === option.target && q.ownerId === menu.ownerId);
    if (!queue) {
      const twiml = new VoiceResponse();
      twiml.say('That department is not available right now. Goodbye.');
      twiml.hangup();
      return xmlResponse(twiml);
    }

    const twiml = new VoiceResponse();
    // No waitUrl specified — Twilio plays its own default hold music,
    // which keeps this simpler and gives one less unauthenticated webhook
    // to secure and maintain for what's a non-critical cosmetic feature.
    twiml.enqueue(queue.twilioQueueName);

    // Ring available agents AFTER building the response to send back —
    // the caller shouldn't wait on this before hearing hold music start.
    // Fire-and-forget, same reasoning as the PayFast ITN webhook: this
    // works correctly because the app deploys via `next start` on
    // Railway, a persistent process, not serverless.
    notifyAgents(queue, posted.To).catch((err) => {
      console.error('Failed to notify agents for queue', queue.id, err.message);
    });

    return xmlResponse(twiml);
  }

  const fallback = new VoiceResponse();
  fallback.say('Something went wrong. Goodbye.');
  fallback.hangup();
  return xmlResponse(fallback);
}
