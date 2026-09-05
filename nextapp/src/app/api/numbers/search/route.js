import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { twilioClient, isTwilioConfigured } = require('@/lib/twilioClient');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/numbers/search?country=US&areaCode=415
 * Searches for available numbers to provision.
 */
async function GET_impl(request) {
  try {
    requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const country = request.nextUrl.searchParams.get('country') || 'US';
  const areaCode = request.nextUrl.searchParams.get('areaCode');
  const supported = (process.env.SUPPORTED_NUMBER_COUNTRIES || 'US,CA,GB').split(',');

  if (!supported.includes(country)) {
    return NextResponse.json({
      error: `Numbers for "${country}" are not offered by this platform yet.`,
      supportedCountries: supported
    }, { status: 400 });
  }
  if (!isTwilioConfigured()) {
    return NextResponse.json({ error: 'Server is missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in .env' }, { status: 500 });
  }

  try {
    const opts = { limit: 10, voiceEnabled: true };
    if (areaCode) opts.areaCode = areaCode;
    const results = await twilioClient.availablePhoneNumbers(country).local.list(opts);
    return NextResponse.json({
      country,
      results: results.map((r) => ({
        friendlyName: r.friendlyName,
        phoneNumber: r.phoneNumber,
        locality: r.locality,
        region: r.region
      }))
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export const GET = withSanitizedErrors(GET_impl);
