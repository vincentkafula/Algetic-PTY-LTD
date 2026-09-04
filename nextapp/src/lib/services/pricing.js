// ---------------------------------------------------------------------------
// Takes whatever a provider (GoDaddy, Twilio) actually charges in USD, and
// returns what the customer should be charged in ZAR — after currency
// conversion AND a markup, so the business keeps the difference as
// margin. This is the one place that markup math happens; every service
// (domains, numbers, mailboxes) should call through here rather than
// each inventing its own pricing logic.
// ---------------------------------------------------------------------------

const { getUsdToZarRate } = require('./exchangeRate');

const DEFAULT_MARKUP_PERCENT = 25;

/**
 * Reads MARKUP_PERCENT from the environment (a plain number, e.g. "25"
 * for 25%) so the margin can be adjusted without a code change or
 * redeploy-from-scratch — just a Railway variable update. Falls back to
 * a sane default if unset or invalid, rather than failing pricing
 * entirely over a missing config value.
 */
function getMarkupPercent() {
  const configured = parseFloat(process.env.MARKUP_PERCENT);
  if (!isNaN(configured) && configured >= 0) return configured;
  return DEFAULT_MARKUP_PERCENT;
}

/**
 * baseUsdCents: the provider's real price, in US cents (this is exactly
 * the unit GoDaddy's quote API already returns, so callers can pass that
 * value straight through with no conversion of their own first).
 *
 * Returns the full breakdown, not just the final number — useful for
 * this app's own logging/auditing/testing, even though the customer-
 * facing UI should only ever show customerZarCents (the whole point of
 * this feature is the customer never sees the provider's real cost).
 */
async function priceForCustomer(baseUsdCents) {
  if (typeof baseUsdCents !== 'number' || !Number.isFinite(baseUsdCents) || baseUsdCents < 0) {
    throw new Error('baseUsdCents must be a non-negative number');
  }

  const markupPercent = getMarkupPercent();
  const exchangeRate = await getUsdToZarRate();
  const baseZarCents = Math.round(baseUsdCents * exchangeRate);
  const customerZarCents = Math.round(baseZarCents * (1 + markupPercent / 100));

  return { baseUsdCents, exchangeRate, markupPercent, baseZarCents, customerZarCents };
}

/**
 * Formats a ZAR cents value as a display string, e.g. 23147 -> "R231.47".
 */
function formatZarCents(cents) {
  return `R${(cents / 100).toFixed(2)}`;
}

module.exports = { priceForCustomer, getMarkupPercent, formatZarCents };
