import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { isGoDaddyConfigured, getGoDaddyQuote } = require('@/lib/godaddyClient');
const { createOrderWithCheckout } = require('@/lib/services/orders');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * POST /api/domains/register
 * body: { domain, period, agreedAgreementTypes }
 * Does NOT register anything directly — creates a payment order and
 * returns PayFast checkout details. The actual GoDaddy registration
 * happens in the ITN webhook once payment is confirmed, using a
 * freshly-fetched quote at that point.
 *
 * Refetches its own quote here too, rather than trusting a price the
 * client might supply — a client-supplied baseUsdCents would let
 * someone tamper with what they're charged while still receiving a
 * domain worth more. This is the ONLY price this endpoint trusts: what
 * GoDaddy itself says, fetched server-side, right now.
 */
async function POST_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  if (!isGoDaddyConfigured()) {
    return NextResponse.json({ error: 'Server is missing GODADDY_PAT in .env' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { domain, period, agreedAgreementTypes } = body || {};
  if (!domain) return NextResponse.json({ error: 'domain is required' }, { status: 400 });
  if (!Array.isArray(agreedAgreementTypes) || agreedAgreementTypes.length === 0) {
    return NextResponse.json({ error: 'agreedAgreementTypes must list every agreement the customer confirmed — no order was created' }, { status: 400 });
  }

  try {
    const quote = await getGoDaddyQuote(domain, period || 1);
    const result = await createOrderWithCheckout({
      ownerId: user.id,
      ownerEmail: user.email,
      fulfillmentType: 'domain',
      fulfillmentData: { domain, period: period || 1, agreedAgreementTypes },
      baseUsdCents: quote.price.value,
      itemName: domain,
      itemDescription: `Domain registration: ${domain}`
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message, data: err.data }, { status: err.status || 500 });
  }
}
export const POST = withSanitizedErrors(POST_impl);
