import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { isGoDaddyConfigured, getGoDaddyQuote } = require('@/lib/godaddyClient');
const pricing = require('@/lib/services/pricing');

/**
 * POST /api/domains/quote
 * body: { domain, period }
 * Returns what the CUSTOMER would pay — already converted to ZAR and
 * marked up — never GoDaddy's raw USD price. Deliberately does not
 * return a quoteToken to the frontend either: the register endpoint
 * fetches its own fresh quote right before charging anyone, rather than
 * reusing one that could be stale by then.
 */
export async function POST(request) {
  try {
    requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  if (!isGoDaddyConfigured()) {
    return NextResponse.json({ error: 'Server is missing GODADDY_PAT in .env' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { domain, period } = body || {};
  if (!domain) return NextResponse.json({ error: 'domain is required' }, { status: 400 });

  try {
    const quote = await getGoDaddyQuote(domain, period || 1);
    const price = await pricing.priceForCustomer(quote.price.value);
    return NextResponse.json({
      domain,
      period: period || 1,
      customerPriceCents: price.customerZarCents,
      customerPriceFormatted: pricing.formatZarCents(price.customerZarCents),
      expiresAt: quote.expiresAt,
      requiredAgreements: quote.requiredAgreements || quote.agreements || []
    });
  } catch (err) {
    return NextResponse.json({ error: err.message, data: err.data }, { status: err.status || 500 });
  }
}
