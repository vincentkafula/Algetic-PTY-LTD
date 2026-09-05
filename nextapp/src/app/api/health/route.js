import { NextResponse } from 'next/server';

const { isMailgunConfigured, isInboundCaptureConfigured } = require('@/lib/mailgunClient');
const { isTwilioConfigured } = require('@/lib/twilioClient');
const { isGoDaddyConfigured } = require('@/lib/godaddyClient');
const { isConfigured: isPayfastConfigured } = require('@/lib/services/payfast');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/health
 * Ported from server.js's /api/health. Not behind requireAuth in the
 * Express version either — the dashboard shell fetches this before it
 * necessarily has a confirmed-valid session yet, and none of this
 * reveals anything sensitive (just which integrations are configured).
 */
async function GET_impl() {
  return NextResponse.json({
    ok: true,
    jwtConfigured: Boolean(process.env.JWT_SECRET),
    mailgunConfigured: isMailgunConfigured(),
    mailgunInboundCaptureConfigured: isInboundCaptureConfigured(),
    twilioConfigured: isTwilioConfigured(),
    teamCallingConfigured: isTwilioConfigured() && Boolean(process.env.PUBLIC_BASE_URL),
    callCentreConfigured: isTwilioConfigured() && Boolean(process.env.PUBLIC_BASE_URL),
    domainsConfigured: isGoDaddyConfigured(),
    paymentsConfigured: isPayfastConfigured() && Boolean(process.env.PUBLIC_BASE_URL),
    supportedCountries: (process.env.SUPPORTED_NUMBER_COUNTRIES || 'US,CA,GB').split(',')
  });
}
export const GET = withSanitizedErrors(GET_impl);
