const db = require('@/lib/db');
const { verifyTwilioSignature, rejectUnsigned, xmlResponse, VoiceResponse } = require('@/lib/callCentreVoice');

/**
 * POST /api/webhooks/twilio/agent-connect?queueId=<id>
 * TwiML fetched when an agent answers the outbound call Altegic placed
 * to ring them — bridges them to the oldest waiting caller in the queue.
 */
export async function POST(request) {
  const formData = await request.formData().catch(() => null);
  const posted = formData ? Object.fromEntries(formData.entries()) : {};

  if (!verifyTwilioSignature(request, posted)) return rejectUnsigned();

  const queueId = request.nextUrl.searchParams.get('queueId');
  const queue = db.callQueues.find((q) => q.id === queueId);
  const twiml = new VoiceResponse();
  if (!queue) {
    twiml.say('This queue is no longer available. Goodbye.');
    twiml.hangup();
    return xmlResponse(twiml);
  }

  twiml.say('Connecting you now.');
  // timeout caps how long this agent leg waits if it loses the race to
  // another agent leg for the same (single) waiting caller.
  const dial = twiml.dial({ timeout: 15 });
  dial.queue(queue.twilioQueueName);
  return xmlResponse(twiml);
}
