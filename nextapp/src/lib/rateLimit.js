// ---------------------------------------------------------------------------
// A minimal in-memory rate limiter for endpoints that don't require login —
// specifically built for the public domain search, which calls GoDaddy's
// real API (a real rate limit of 60 req/min per credential, per GoDaddy's
// own docs) on behalf of anyone visiting the site, logged in or not.
// Without SOME limit here, a single abusive visitor (or a scraping bot)
// could exhaust Altegic's entire GoDaddy quota and break search for real
// customers too.
//
// HONEST LIMITATION: this is in-memory, per server process, and resets on
// restart/redeploy — a reasonable, proportionate safeguard for an app
// already built on a single-process JSON-file store (see db.js's own
// header comment on that), not a production-grade defense. A real
// production deployment at meaningful public traffic would want a proper
// distributed limiter (Redis, or a CDN/WAF layer like Cloudflare) in front
// of this, not just this module.
// ---------------------------------------------------------------------------

const buckets = new Map(); // ip -> { count, windowStartedAt }

/**
 * Returns { allowed, remaining } for this IP under the given limit.
 * windowMs: the sliding window length in milliseconds.
 * maxRequests: how many requests are allowed per window.
 */
function checkRateLimit(ip, { windowMs = 60_000, maxRequests = 20 } = {}) {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.windowStartedAt > windowMs) {
    buckets.set(ip, { count: 1, windowStartedAt: now });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (bucket.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: maxRequests - bucket.count };
}

/**
 * Best-effort real client IP from standard proxy headers (Railway, like
 * most PaaS platforms, sits behind a proxy that sets these) — falls back
 * to a constant if neither is present, which just means everyone without
 * a forwarded header shares one bucket rather than the limiter breaking.
 */
function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

module.exports = { checkRateLimit, getClientIp };
