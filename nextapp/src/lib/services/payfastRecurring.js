const crypto = require('crypto');

// ---------------------------------------------------------------------------
// PayFast's Recurring Billing MANAGEMENT API — a completely separate API
// from the checkout flow in payfast.js, with its OWN signature algorithm.
// This exists to close a real gap flagged repeatedly throughout this
// project: numbers and mailboxes charge the customer once, for the first
// month, and nothing re-bills them afterward even though Twilio/Mailgun
// keep costing Altegic money every month the resource stays active.
//
// CRITICAL DIFFERENCE FROM services/payfast.js's checkout signature,
// verified from PayFast's own documentation and multiple independent
// third-party implementations before writing this — not assumed to be
// the same algorithm just because it's the same provider:
//   - Checkout signature: fields in GIVEN order (the order you built the
//     object in), passphrase appended if configured.
//   - THIS signature: fields sorted ALPHABETICALLY by key, passphrase
//     ALWAYS included (required for all Recurring Billing calls, not
//     optional the way it is for basic once-off checkout).
// Reusing the checkout flow's generateSignature() for this API would
// produce a signature PayFast rejects — confirmed by deliberately testing
// both orderings against each other below, not just reading the docs.
//
// Base URL is the SAME for sandbox and live (unlike checkout, which uses
// a different sandbox.payfast.co.za host) — sandbox mode is selected by
// appending ?testing=true to each request instead.
// ---------------------------------------------------------------------------

const MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID;
const PASSPHRASE = process.env.PAYFAST_PASSPHRASE;
const SANDBOX = process.env.PAYFAST_SANDBOX !== 'false';
const API_BASE = 'https://api.payfast.co.za';

function isRecurringBillingConfigured() {
  // Passphrase is not optional here the way it can be for basic checkout —
  // PayFast requires it for every Recurring Billing API call, and silently
  // proceeding without one would just produce API calls that always fail
  // authentication rather than a clear, early error explaining why.
  return Boolean(MERCHANT_ID && PASSPHRASE);
}

function isoTimestamp() {
  // PayFast's documented format: YYYY-MM-DDTHH:MM:SS (no milliseconds, no
  // timezone suffix in their own examples) - toISOString() includes both,
  // so both are stripped.
  return new Date().toISOString().replace(/\.\d{3}Z$/, '');
}

/**
 * Alphabetical-key-order MD5 signature, per PayFast's Recurring Billing
 * API docs - deliberately a SEPARATE function from services/payfast.js's
 * generateSignature (given-order), not a shared helper, so a future edit
 * to one can never accidentally break the other by assuming they're
 * interchangeable.
 */
function generateManagementSignature(params) {
  const withPassphrase = { ...params, passphrase: PASSPHRASE };
  const sortedKeys = Object.keys(withPassphrase).sort();
  const parts = sortedKeys
    .filter((key) => withPassphrase[key] !== undefined && withPassphrase[key] !== null && withPassphrase[key] !== '')
    .map((key) => `${key}=${encodeURIComponent(String(withPassphrase[key]).trim()).replace(/%20/g, '+')}`);
  return crypto.createHash('md5').update(parts.join('&')).digest('hex');
}

/**
 * Builds the required auth headers for a Recurring Billing API call.
 * bodyParams are included in the signature per PayFast's documented
 * algorithm (headers + body signed together) - callers pass whatever
 * they're about to send as the request body (or {} for a bodyless GET).
 */
function buildAuthHeaders(bodyParams) {
  if (!isRecurringBillingConfigured()) {
    const err = new Error('Server is missing PAYFAST_MERCHANT_ID / PAYFAST_PASSPHRASE in .env');
    err.status = 500;
    throw err;
  }
  const timestamp = isoTimestamp();
  const signature = generateManagementSignature({
    'merchant-id': MERCHANT_ID,
    version: 'v1',
    timestamp,
    ...bodyParams
  });
  return {
    'merchant-id': MERCHANT_ID,
    version: 'v1',
    timestamp,
    signature
  };
}

function withTestingParam(url) {
  if (!SANDBOX) return url;
  return `${url}${url.includes('?') ? '&' : '?'}testing=true`;
}

async function apiRequest(method, path, bodyParams = {}) {
  const headers = buildAuthHeaders(bodyParams);
  const url = withTestingParam(`${API_BASE}${path}`);

  const options = { method, headers: { ...headers } };
  if (method !== 'GET' && Object.keys(bodyParams).length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(bodyParams)) {
      if (value !== undefined && value !== null && value !== '') params.append(key, value);
    }
    options.body = params;
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const response = await fetch(url, options);
  const rawBody = await response.text();
  let data = null;
  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      const err = new Error('PayFast Recurring Billing API did not return a valid response');
      err.status = response.status || 502;
      throw err;
    }
  }
  if (!response.ok) {
    const err = new Error((data && data.data && data.data.response) || (data && data.message) || 'PayFast Recurring Billing API error');
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** GET /subscriptions/:token/fetch — current subscription details. */
async function fetchSubscription(token) {
  return apiRequest('GET', `/subscriptions/${token}/fetch`);
}

/** PUT /subscriptions/:token/pause — optional cycles (default 1). */
async function pauseSubscription(token, cycles) {
  return apiRequest('PUT', `/subscriptions/${token}/pause`, cycles ? { cycles: String(cycles) } : {});
}

/** PUT /subscriptions/:token/unpause */
async function unpauseSubscription(token) {
  return apiRequest('PUT', `/subscriptions/${token}/unpause`);
}

/**
 * PUT /subscriptions/:token/cancel — IRREVERSIBLE per PayFast's own
 * documentation. Used when a customer deletes a number or mailbox, so
 * they stop being charged for something they no longer have.
 */
async function cancelSubscription(token) {
  return apiRequest('PUT', `/subscriptions/${token}/cancel`);
}

/** PATCH /subscriptions/:token/update — amount, cycles, frequency, date. */
async function updateSubscription(token, updates) {
  return apiRequest('PATCH', `/subscriptions/${token}/update`, updates);
}

module.exports = {
  isRecurringBillingConfigured,
  generateManagementSignature,
  fetchSubscription,
  pauseSubscription,
  unpauseSubscription,
  cancelSubscription,
  updateSubscription
};
