const fetch = require('node-fetch');

const GODADDY_PAT = process.env.GODADDY_PAT;
const GODADDY_BASE_URL = 'https://api.godaddy.com/v3';

function isGoDaddyConfigured() {
  return Boolean(GODADDY_PAT && GODADDY_PAT !== 'your_godaddy_personal_access_token_here');
}

function authHeader() {
  return `Bearer ${GODADDY_PAT}`;
}

/**
 * Fetches a fresh, real-time price quote from GoDaddy for a domain.
 * Deliberately NOT cached anywhere and always called fresh — both by
 * routes/domains.js (to show the customer a price and again right before
 * creating a payment order) and by routes/paymentWebhooks.js (again,
 * right before actually registering, once payment clears) — because a
 * GoDaddy quoteToken is time-limited, and trusting an old one at
 * fulfillment time (which could be minutes or longer after the customer
 * started checkout) risks the registration call failing after the
 * customer has already paid. Throws on failure; callers must handle
 * that rather than assume a quote always succeeds.
 */
async function getGoDaddyQuote(domain, period) {
  const response = await fetch(`${GODADDY_BASE_URL}/domains/registration-quotes`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, period: period || 1 })
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.message || 'GoDaddy quote error');
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Executes the actual registration — the step that charges Altegic's own
 * GoDaddy payment profile and is not reversible. Requires a quoteToken
 * from a quote fetched immediately before calling this (see above).
 */
async function registerGoDaddyDomain({ quoteToken, domain, period, agreedAgreementTypes }) {
  const idempotencyKey = require('crypto').randomUUID();
  const response = await fetch(`${GODADDY_BASE_URL}/domains/registrations`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({
      quoteToken,
      domain,
      period: period || 1,
      consent: {
        agreedAt: new Date().toISOString(),
        agreementTypes: agreedAgreementTypes
      }
    })
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.message || 'GoDaddy registration error');
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

module.exports = { GODADDY_BASE_URL, isGoDaddyConfigured, authHeader, getGoDaddyQuote, registerGoDaddyDomain };
