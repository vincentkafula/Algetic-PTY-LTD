const { twilioClient, isTwilioConfigured } = require('../twilioClient');

// ---------------------------------------------------------------------------
// Ported from server/services/twilioPricing.js — no Express-specific code.
//
// Real, account-specific Twilio phone number pricing, via Twilio's own
// Pricing API (a genuinely different resource from the number-search API
// used elsewhere — searching for available numbers doesn't return their
// price at all, this is the only way to get a real one).
//
// UNTESTED against a live Twilio account (same honest limitation as the
// rest of this project's Twilio-dependent code) — verified against
// Twilio's own current documentation before writing this, not guessed.
// ---------------------------------------------------------------------------

function assertConfigured() {
  if (!isTwilioConfigured()) {
    const err = new Error('Server is missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in .env');
    err.status = 500;
    throw err;
  }
}

/**
 * Twilio's number-search results don't say whether a number is local,
 * mobile, national, or toll-free explicitly in a field this app already
 * reads — but this app only ever searches .local numbers (see the
 * numbers search route), so pricing is always looked up as "local" to
 * match. If that ever changes, this needs to change with it.
 */
const NUMBER_TYPE = 'local';

/**
 * Returns Twilio's real monthly cost for a phone number in the given
 * country, in USD CENTS (matching the convention pricing.js expects,
 * and matching how GoDaddy's own API already returns prices in this
 * codebase) — Twilio's Pricing API itself returns decimal dollar
 * strings/numbers (e.g. "1.15"), not cents, so the conversion happens
 * here, once, rather than leaving every caller to remember it.
 *
 * Throws if the country has no pricing data — Twilio's own documented
 * behavior for a country where numbers aren't purchasable through the
 * API is to return null fields rather than an error, so this function
 * turns that into an explicit throw instead of silently returning
 * something callers might mistake for a valid free/zero price.
 */
async function getMonthlyNumberCostUsdCents(country) {
  assertConfigured();
  const result = await twilioClient.pricing.v1.phoneNumbers.countries(country).fetch();
  const prices = result.phoneNumberPrices || [];
  const match = prices.find((p) => p.numberType === NUMBER_TYPE);
  if (!match || match.currentPrice == null) {
    const err = new Error(`No pricing available for ${NUMBER_TYPE} numbers in ${country}`);
    err.status = 502;
    throw err;
  }
  return Math.round(parseFloat(match.currentPrice) * 100);
}

module.exports = { getMonthlyNumberCostUsdCents };
