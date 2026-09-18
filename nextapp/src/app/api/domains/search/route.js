import { NextResponse } from 'next/server';

const { GODADDY_BASE_URL, isGoDaddyConfigured, authHeader } = require('@/lib/godaddyClient');
const pricing = require('@/lib/services/pricing');
const { withSanitizedErrors } = require('@/lib/sanitizeError');
const { checkRateLimit, getClientIp } = require('@/lib/rateLimit');

/**
 * GET /api/domains/search?domain=example.com
 * PUBLIC — no account login required, so a visitor can search before
 * ever signing up (matching how GoDaddy's own search works). Read-only,
 * no charges, no account interaction on GoDaddy's side beyond the lookup
 * itself. Rate-limited per IP instead of requiring auth, since this now
 * calls a real (rate-limited) GoDaddy API on behalf of anyone, logged in
 * or not — see rateLimit.js for why.
 *
 * Converts every returned price to ZAR (with markup) before sending it
 * to the frontend — GoDaddy's check-availability response includes raw
 * USD cent prices, and this app never shows a customer a provider's raw
 * cost anywhere else (see /api/domains/quote), so this shouldn't either.
 * These prices are explicitly "indicative" per GoDaddy's own docs — the
 * authoritative, locked price still only comes from POST
 * /v3/domains/registration-quotes at actual purchase time (which DOES
 * require login, via /api/domains/quote).
 */
async function GET_impl(request) {
  const ip = getClientIp(request);
  const { allowed } = checkRateLimit(ip, { windowMs: 60_000, maxRequests: 20 });
  if (!allowed) {
    return NextResponse.json({ error: 'Too many searches — please wait a moment and try again.' }, { status: 429 });
  }

  if (!isGoDaddyConfigured()) {
    return NextResponse.json({ error: 'Server is missing GODADDY_PAT in .env' }, { status: 500 });
  }

  const domain = request.nextUrl.searchParams.get('domain');
  if (!domain) return NextResponse.json({ error: 'domain query param is required' }, { status: 400 });

  try {
    const url = new URL(`${GODADDY_BASE_URL}/domains/check-availability`);
    url.searchParams.set('domain', domain);
    const response = await fetch(url, { headers: { Authorization: authHeader() } });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.message || 'GoDaddy error', data }, { status: response.status });

    const prices = data.prices ? await Promise.all(data.prices.map(async (p) => {
      const price = await pricing.priceForCustomer(p.price.value);
      return { term: p.term, period: p.period, customerPriceFormatted: pricing.formatZarCents(price.customerZarCents) };
    })) : [];

    return NextResponse.json({ domain: data.domain, available: data.available, prices });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export const GET = withSanitizedErrors(GET_impl);


