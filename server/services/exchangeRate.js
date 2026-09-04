// ---------------------------------------------------------------------------
// USD -> ZAR conversion, needed because GoDaddy and Twilio price everything
// in USD, but PayFast (the payment processor customers actually pay
// through) only settles in ZAR. Uses Frankfurter (api.frankfurter.dev),
// which serves European Central Bank reference rates - free, no API key,
// no published rate limit, ZAR confirmed as one of its ~31 supported
// currencies.
//
// HONEST LIMITATION: ECB rates update once per working day (~16:00 CET),
// not live tick-by-tick. For a small business reseller charging retail
// prices with a markup already built in, a rate that's at most ~24 hours
// stale is a reasonable tradeoff against paying for a real-time forex
// data feed — but it IS a real gap, not zero risk, if the Rand moves
// sharply in a single day. Documented here rather than left implicit.
// ---------------------------------------------------------------------------

const fetch = require('node-fetch');

const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — see honest limitation above

let cache = { rate: null, fetchedAt: 0 };

/**
 * Returns how many ZAR one USD is worth right now (a plain number, e.g.
 * 18.42). Caches for an hour so a burst of pricing requests doesn't hit
 * Frankfurter on every single call. Throws on failure rather than
 * silently falling back to a stale or made-up rate — a wrong exchange
 * rate directly means charging a real customer the wrong amount of real
 * money, so callers MUST handle this failing rather than assume it never
 * does.
 */
async function getUsdToZarRate() {
  const now = Date.now();
  if (cache.rate && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rate;
  }

  const response = await fetch(`${FRANKFURTER_URL}?base=USD&symbols=ZAR`);
  if (!response.ok) {
    throw new Error(`Exchange rate service returned ${response.status}`);
  }
  const data = await response.json();
  const rate = data.rates && data.rates.ZAR;
  if (typeof rate !== 'number' || rate <= 0) {
    throw new Error('Exchange rate service returned an unusable ZAR rate');
  }

  cache = { rate, fetchedAt: now };
  return rate;
}

/**
 * Converts a USD amount (in cents, matching how GoDaddy/Twilio quote
 * prices) into ZAR cents.
 */
async function usdCentsToZarCents(usdCents) {
  const rate = await getUsdToZarRate();
  return Math.round(usdCents * rate);
}

module.exports = { getUsdToZarRate, usdCentsToZarCents };
