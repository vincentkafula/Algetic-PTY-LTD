import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { GODADDY_BASE_URL, isGoDaddyConfigured, authHeader } = require('@/lib/godaddyClient');
const pricing = require('@/lib/services/pricing');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/domains/suggestions?query=my+bakery&tlds=com,net
 * Natural-language / keyword domain name suggestions — GoDaddy's engine
 * returns only AVAILABLE domains here (no separate availability check
 * needed for each result). Same ZAR conversion as /api/domains/search;
 * see that file's comment for why raw USD prices never reach the
 * frontend.
 */
async function GET_impl(request) {
  try {
    requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  if (!isGoDaddyConfigured()) {
    return NextResponse.json({ error: 'Server is missing GODADDY_PAT in .env' }, { status: 500 });
  }

  const query = request.nextUrl.searchParams.get('query');
  const tlds = request.nextUrl.searchParams.get('tlds');

  try {
    const url = new URL(`${GODADDY_BASE_URL}/domains/suggestions`);
    if (query) url.searchParams.set('query', query);
    if (tlds) url.searchParams.set('tlds', tlds);
    url.searchParams.set('pageSize', '10');
    const response = await fetch(url, { headers: { Authorization: authHeader() } });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.message || 'GoDaddy error', data }, { status: response.status });

    const items = await Promise.all((data.items || []).map(async (item) => {
      const firstPrice = item.prices && item.prices[0];
      let customerPriceFormatted = null;
      if (firstPrice) {
        const price = await pricing.priceForCustomer(firstPrice.price.value);
        customerPriceFormatted = pricing.formatZarCents(price.customerZarCents);
      }
      return { domain: item.domain, customerPriceFormatted };
    }));

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export const GET = withSanitizedErrors(GET_impl);

