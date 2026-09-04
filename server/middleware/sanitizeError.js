// ---------------------------------------------------------------------------
// Customers should never see "GoDaddy", "Twilio", or "Mailgun" in an error
// message — but error text throughout this app mostly comes straight from
// each provider's own SDK/API response (err.message, or a provider's raw
// error body passed through), not from strings this app wrote itself. That
// makes a global response-level sanitizer the actually complete fix, rather
// than manually rewriting the ~20+ individual `res.json({ error: ... })`
// call sites across domains.js/numbers.js/mailboxes.js/teamCalling.js — a
// new route added later gets this protection automatically too.
//
// Wraps res.json so any error response (a body with a string `error`
// field) gets provider names replaced with generic terms before it's
// ever sent, and drops the raw provider error body some routes pass
// through as `data` alongside it. Deliberately scoped to error responses
// only — several legitimate endpoints (e.g. the MVNO dashboard) use a
// `data` field for their actual non-error payload, and this must never
// touch those. This only touches HTTP responses — server-side
// console.error logging (genuinely useful for debugging, never seen by
// a customer) is deliberately left untouched.
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
  // one produces garbled, worse-looking text (e.g. a low-level fetch
  // failure like "invalid json response body at https://api.godaddy.com/..."
  // becoming "...at https://api.the domain registry.com/..." — a
  // nonsensical string, not a clean sentence). Replace the whole message
  // in that case rather than trying to surgically edit it.
  // Same reasoning as the URL case above: a message mentioning ".env" or
  // a credential/config term is itself a technical leak (reveals this is
  // a self-hosted app with environment-variable configuration), and
  // substituting a vendor name inside something like "Server is missing
  // GODADDY_PAT in .env" produces the same kind of garbled half-replaced
  // text ("the domain registry_PAT"). This exact pattern is also the
  // single most common error message a newly-configured account would
  // actually see (whenever a feature isn't set up yet), so it's worth
  // its own clean rule rather than leaving it to the URL check to catch
  // occasionally.
  if (/\.env\b/i.test(message)) {
    return "This feature isn't available on your account yet. Please contact support.";
  }

  if (/https?:\/\//i.test(message)) {
    return 'Something went wrong on our end. Please try again in a moment.';
  }

  let result = message;
  for (const [pattern, replacement] of REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function sanitizeErrorMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object' && typeof body.error === 'string') {
      body.error = sanitizeErrorMessage(body.error);
      // GoDaddy-style ERROR responses also pass through the raw provider
      // error body as `data` for debugging — drop it too, rather than
      // trying to sanitize an object of unknown shape field-by-field.
      // Scoped to error responses only: several legitimate endpoints
      // (e.g. the MVNO dashboard) use `data` for their actual, non-error
      // payload, and stripping it there would break the feature outright
      // — caught exactly this way, testing against a running server,
      // before this ever reached production.
      if (body.data && typeof body.data === 'object') {
        delete body.data;
      }
    }
    return originalJson(body);
  };
  next();
}

module.exports = { sanitizeErrorMessage, sanitizeErrorMiddleware };
