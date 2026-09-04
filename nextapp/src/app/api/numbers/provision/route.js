import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { isTwilioConfigured } = require('@/lib/twilioClient');
const { getMonthlyNumberCostUsdCents } = require('@/lib/services/twilioPricing');
const { createOrderWithCheckout } = require('@/lib/services/orders');

/**
 * POST /api/numbers/provision
 * body: { phoneNumber, country, customerLabel }
 * Does NOT buy anything directly — fetches the real monthly cost from
 * Twilio's Pricing API, creates a payment order, and returns PayFast
 * checkout details. The actual purchase + trunk attachment happens in
 * the ITN webhook once payment clears (services/trunking.js's
 * provisionNumberForAccount).
 */
export async function POST(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { phoneNumber, country, customerLabel } = body || {};
  if (!phoneNumber) return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 });
  if (!country) return NextResponse.json({ error: 'country is required' }, { status: 400 });
  if (!isTwilioConfigured()) {
    return NextResponse.json({ error: 'Server is missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in .env' }, { status: 500 });
  }

  try {
    const baseUsdCents = await getMonthlyNumberCostUsdCents(country);
    const result = await createOrderWithCheckout({
      ownerId: user.id,
      ownerEmail: user.email,
      fulfillmentType: 'number',
      fulfillmentData: { phoneNumber, customerLabel: customerLabel || null },
      baseUsdCents,
      itemName: phoneNumber,
      itemDescription: `Phone number: ${phoneNumber} (first month)`
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
