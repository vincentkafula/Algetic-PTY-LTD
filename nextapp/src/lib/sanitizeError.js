// ---------------------------------------------------------------------------
// Customers should never see "GoDaddy", "Twilio", or "Mailgun" in an error
// message — but most error text in this app isn't copy this app wrote;
// it's forwarded straight from a provider's own SDK/API response
// (err.message, or a raw provider error body). Ported from the Express
// version's middleware/sanitizeError.js, including both real bugs found
// while testing that version (see below) — carried forward as fixes, not
// rediscovered from scratch.
//
// REAL ARCHITECTURAL DIFFERENCE FROM THE EXPRESS VERSION: Express's
// version worked by monkey-patching res.json() in a single global
// middleware, since Express middleware runs around every request/response
// pair and can intercept a handler's output before it's sent. Next.js's
// middleware.ts has no equivalent capability — it runs BEFORE a Route
// Handler executes and can produce an early response, but cannot inspect
// or rewrite a Route Handler's own response body afterward. The
// replacement here is a wrapper function applied to each exported
// handler (withSanitizedErrors(async (request) => {...})) that reads the
// handler's returned NextResponse, sanitizes it if it looks like an error
// body, and returns the (possibly rewritten) response — same effect,
// different mechanism, necessarily applied per-route rather than truly
// globally in one place.
// ---------------------------------------------------------------------------

const REPLACEMENTS = [
  [/godaddy/gi, 'the domain registry'],
  [/twilio/gi, 'the phone service'],
  [/mailgun/gi, 'the email service']
];

function sanitizeErrorMessage(message) {
  if (typeof message !== 'string') return message;

  // A message containing a raw URL is itself a leak (exposes real API
  // endpoints/hostnames), and blindly substituting a vendor name inside
  // one produces garbled, worse-looking text than the original (e.g. a
  // low-level fetch failure like "invalid json response body at
  // https://api.godaddy.com/..." becoming "...at https://api.the domain
  // registry.com/..." — a nonsensical string). Bug #1 from the Express
  // version, fixed there and carried forward here: replace the whole
  // message in that case rather than trying to surgically edit it.
  if (/https?:\/\//i.test(message)) {
    return 'Something went wrong on our end. Please try again in a moment.';
  }

  // The identical mangling affects the single most common message a
  // newly-configured account would actually see ("Server is missing
  // GODADDY_PAT in .env" -> "the domain registry_PAT", a dangling
  // suffix). Same fix as the URL case.
  if (/\.env\b/i.test(message)) {
    return "This feature isn't available on your account yet. Please contact support.";
  }

  let result = message;
  for (const [pattern, replacement] of REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Wraps a Route Handler export. Reads the NextResponse it returns; if
 * the body is JSON with a string `error` field, sanitizes that field and
 * rebuilds the response with the same status. Any `data` field is
 * dropped too (GoDaddy-style responses pass through the raw provider
 * error body for debugging) — but ONLY on responses that also carry an
 * `error` field. Bug #2 from the Express version, fixed there and
 * carried forward: an earlier version of this stripped ANY `data` field
 * unconditionally, which broke the MVNO dashboard outright (its real
 * payload lives in a `data` field on a SUCCESSFUL response, unrelated to
 * an error body's `data`). Scoping the strip to error responses only is
 * what makes this safe to apply broadly.
 */
function withSanitizedErrors(handler) {
  return async function wrapped(...args) {
    const response = await handler(...args);

    // Not a JSON response, or no body to inspect (e.g. 204 No Content) —
    // nothing to sanitize, pass through untouched.
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return response;

    let body;
    try {
      body = await response.clone().json();
    } catch {
      return response;
    }

    if (!body || typeof body !== 'object' || typeof body.error !== 'string') {
      return response;
    }

    const sanitized = { ...body, error: sanitizeErrorMessage(body.error) };
    delete sanitized.data;

    return new Response(JSON.stringify(sanitized), {
      status: response.status,
      headers: response.headers
    });
  };
}

module.exports = { sanitizeErrorMessage, withSanitizedErrors };
