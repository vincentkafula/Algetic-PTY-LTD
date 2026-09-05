const db = require('@/lib/db');
const { verifyTwilioSignature, rejectUnsigned, xmlResponse, buildMenuTwiml, VoiceResponse } = require('@/lib/callCentreVoice');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * POST /api/webhooks/twilio/voice?menuId=<id>
 * Entry point when someone calls a number assigned to a menu.
 */
async function POST_impl(request) {
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

  return xmlResponse(buildMenuTwiml(menu));
}
export const POST = withSanitizedErrors(POST_impl);
