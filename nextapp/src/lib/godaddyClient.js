// ---------------------------------------------------------------------------
// Ported from server/godaddyClient.js — no Express-specific code, so
// nothing needed adapting beyond dropping node-fetch for Node 22's native
// global fetch (consistent with the rest of this migration).
// ---------------------------------------------------------------------------

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
 * Deliberately NOT cached anywhere and always called fresh — both to
 * show the customer a price / right before creating a payment order,
 * and again right before actually registering once payment clears —
 * because a GoDaddy quoteToken is time-limited, and trusting an old one
 * at fulfillment time (which could be minutes or longer after the
 * customer started checkout) risks the registration call failing after
 * the customer has already paid. Throws on failure; callers must handle
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

/**
 * Fetches a domain's current registry state via GoDaddy's v1 domain-
 * detail endpoint — the two fields that matter for renewal tracking are
 * `expires` (ISO timestamp) and `renewAuto` (boolean). Deliberately a
 * SEPARATE endpoint from getGoDaddyQuote/registerGoDaddyDomain, which
 * are v3 (the newer quote-execute registration API) — renewal
 * management isn't available in v3 yet, confirmed directly against
 * GoDaddy's own current documentation before writing this, not assumed
 * to be the same version just because it's the same provider. See
 * setDomainAutoRenew below for why a full "charge the customer and
 * renew" flow isn't built yet, even though this read is safe today.
 */
async function getGoDaddyDomainDetail(domain) {
  const response = await fetch(`https://api.godaddy.com/v1/domains/${domain}`, {
    headers: { Authorization: authHeader(), Accept: 'application/json' }
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.message || 'GoDaddy domain detail error');
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Toggles GoDaddy's own auto-renew flag for a domain — free to change,
 * idempotent, no money involved (GoDaddy only actually charges Altegic
 * when the auto-renewal fires near expiry, not when this flag is set).
 * Returns nothing meaningful on success (204 No Content).
 *
 * HONEST GAP, stated directly: this does NOT re-charge the Altegic
 * customer for the renewal when GoDaddy's own auto-renewal eventually
 * fires, and there is no manual "renew now, charge the customer" flow
 * built yet either. Confirming the renewal price ahead of a manual
 * renewal requires GET /v2/customers/{customerId}/domains/{domain} —
 * a genuinely different identifier from anything already stored in
 * this app (customerId is a UUID tied to the GoDaddy Shoppers API, not
 * derivable from the PAT itself) — resolving that is real, separate
 * work, not something to guess at for a feature that charges real
 * money. What IS safe and built: reading and displaying a domain's
 * real expiry date and current auto-renew state, and letting an
 * account toggle GoDaddy's own auto-renew flag, so a domain is at
 * least visible and controllable rather than silently expiring
 * unnoticed.
 */
async function setDomainAutoRenew(domain, renewAuto) {
  const response = await fetch(`https://api.godaddy.com/v1/domains/${domain}`, {
    method: 'PATCH',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ renewAuto })
  });
  if (response.status === 204) return;
  const data = await response.json().catch(() => ({}));
  const err = new Error(data.message || 'GoDaddy auto-renew update error');
  err.status = response.status;
  err.data = data;
  throw err;
}

module.exports = { GODADDY_BASE_URL, isGoDaddyConfigured, authHeader, getGoDaddyQuote, registerGoDaddyDomain, getGoDaddyDomainDetail, setDomainAutoRenew };
