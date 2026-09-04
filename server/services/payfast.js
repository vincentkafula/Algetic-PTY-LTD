const crypto = require('crypto');

// ---------------------------------------------------------------------------
// PayFast integration — South African payment gateway. Customers pay
// through this, never through GoDaddy/Twilio/Mailgun directly, which is
// the whole point: they should never see those names.
//
// ⚠️ HONESTY NOTE, read before trusting this with real money: this was
// written carefully from PayFast's own official documentation and
// reference implementations, but COULD NOT BE TESTED end-to-end — no
// PayFast merchant credentials were available while building this, and
// PayFast's signature algorithm has caused real production outages for
// other developers over exactly the kind of small detail (passphrase
// inclusion rules, parameter ordering) documented below. Run real test
// transactions against PayFast's sandbox before trusting this with a
// single real customer.
//
// SPECIFIC UNCERTAINTY: sources disagree on whether the passphrase is
// included in the signature in sandbox mode as well as live mode, or
// live mode only. This implementation includes it whenever
// PAYFAST_PASSPHRASE is set, regardless of sandbox/live — matching what
// PayFast's own current official PHP SDK examples show (passPhrase
// supplied alongside testMode: true in their sample code). If real
// sandbox testing shows "signature mismatch" errors, this is the first
// place to check.
// ---------------------------------------------------------------------------

const MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID;
const MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY;
const PASSPHRASE = process.env.PAYFAST_PASSPHRASE;
// Defaults to sandbox — a missing/blank value must never silently mean
// "take real payments".
const SANDBOX = process.env.PAYFAST_SANDBOX !== 'false';

const PROCESS_URL = SANDBOX
  ? 'https://sandbox.payfast.co.za/eng/process'
  : 'https://www.payfast.co.za/eng/process';

// PayFast's documented ITN source IP ranges — real hostnames they
// publish, resolved at request time rather than hardcoded IPs (which
// they've changed before, per PayFast's own troubleshooting docs).
const ITN_HOSTS = ['www.payfast.co.za', 'sandbox.payfast.co.za', 'w1w.payfast.co.za', 'w2w.payfast.co.za'];

function isConfigured() {
  return Boolean(MERCHANT_ID && MERCHANT_KEY);
}

/**
 * PayFast's signature: concatenate every field EXCEPT `signature`, in the
 * exact order given (NOT alphabetically re-sorted — confirmed from
 * PayFast's own reference implementation, contradicting some third-party
 * summaries that claim alphabetical order), as `key=urlencoded(value)&`,
 * strip the trailing `&`, append `&passphrase=urlencoded(passphrase)` if
 * one is configured, then MD5 hash the result.
 *
 * Field ORDER matters for outgoing checkout requests (we control it) —
 * callers must build `fields` in PayFast's documented field order, this
 * function does not reorder anything itself. For verifying an incoming
 * ITN, use verifyItnSignature below instead, which uses the order
 * PayFast itself posted the fields in.
 */
function generateSignature(fields) {
  const parts = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'signature') continue;
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${key}=${encodeURIComponent(String(value).trim()).replace(/%20/g, '+')}`);
  }
  let paramString = parts.join('&');
  if (PASSPHRASE) {
    paramString += `&passphrase=${encodeURIComponent(PASSPHRASE.trim()).replace(/%20/g, '+')}`;
  }
  return crypto.createHash('md5').update(paramString).digest('hex');
}

/**
 * Builds the full set of hidden form fields for a PayFast checkout
 * redirect, including the signature. `orderId` becomes m_payment_id —
 * PayFast echoes this back in the ITN, and it's how we match a
 * confirmed payment back to the pending order in our own database.
 * amountZarCents is converted to PayFast's expected "123.45" string
 * format here so callers never have to remember that detail.
 */
function buildCheckoutFields({ orderId, amountZarCents, itemName, itemDescription, returnUrl, cancelUrl, notifyUrl, email }) {
  if (!isConfigured()) {
    throw new Error('PayFast is not configured (PAYFAST_MERCHANT_ID / PAYFAST_MERCHANT_KEY missing)');
  }
  const fields = {
    merchant_id: MERCHANT_ID,
    merchant_key: MERCHANT_KEY,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    email_address: email,
    m_payment_id: orderId,
    amount: (amountZarCents / 100).toFixed(2),
    item_name: itemName.slice(0, 100), // PayFast's documented max length
    item_description: (itemDescription || '').slice(0, 255)
  };
  const signature = generateSignature(fields);
  return { ...fields, signature };
}

/**
 * Verifies an incoming ITN's signature using the field order PayFast
 * itself posted (from a form body, so Object.entries preserves POST
 * order) — NOT the order buildCheckoutFields used, since PayFast may
 * echo fields back in a different order than they were sent out in.
 */
function verifyItnSignature(postedFields) {
  const expected = generateSignature(postedFields);
  return postedFields.signature === expected;
}

/**
 * Confirms an ITN actually came from PayFast's own servers, not
 * something spoofing a POST to our notify_url. Resolves PayFast's
 * documented hostnames at request time (their IPs have changed before)
 * rather than trusting a hardcoded IP list.
 *
 * Bounded with a timeout deliberately: DNS resolution is an external
 * network call, and this function sits in the middle of the payment
 * confirmation pipeline — a slow or hanging DNS lookup must never be
 * allowed to block order fulfillment indefinitely. Times out fast and
 * fails safe (treated as "couldn't confirm" by the caller, which only
 * logs a warning rather than rejecting the payment — see
 * routes/paymentWebhooks.js for why source-IP checking is advisory,
 * not the primary security control).
 */
async function isFromPayfastIp(remoteIp) {
  const dns = require('dns').promises;
  const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('DNS lookup timed out')), ms))
  ]);

  // Resolved in parallel, not sequentially — bounds the total wait to
  // ~2s regardless of how many hostnames there are, instead of up to
  // 2s PER host stacking up one after another.
  const results = await Promise.allSettled(
    ITN_HOSTS.map((host) => withTimeout(dns.resolve4(host), 2000))
  );
  return results.some((r) => r.status === 'fulfilled' && r.value.includes(remoteIp));
}

module.exports = {
  isConfigured,
  isSandbox: () => SANDBOX,
  PROCESS_URL,
  buildCheckoutFields,
  verifyItnSignature,
  isFromPayfastIp
};
