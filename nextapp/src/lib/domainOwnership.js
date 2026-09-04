const db = require('./db');

// ---------------------------------------------------------------------------
// SECURITY: GODADDY_PAT is one shared credential for the whole Altegic
// deployment, covering every domain in that GoDaddy account — not scoped
// per Altegic customer the way Twilio/Mailgun credentials effectively are
// per-resource. Every DNS route requires :id to match a domain record this
// specific account registered THROUGH Altegic (in db.domains), not just
// any domain string. Without this check, any Altegic account could edit
// DNS for any domain in the underlying GoDaddy account, including ones
// belonging to other Altegic customers. Domains registered directly in
// GoDaddy (outside Altegic) are not manageable here at all — there's no
// local record to match against.
//
// Shared between two separate Route Handler files (dns/route.js and
// dns/[type]/[name]/route.js) — split apart by Next.js's file-based
// routing, unlike Express where this was one local function shared by
// every DNS route in a single routes/domains.js.
// ---------------------------------------------------------------------------

function findOwnedDomain(userId, domainId) {
  return db.domains.find((d) => d.id === domainId && d.ownerId === userId) || null;
}

module.exports = { findOwnedDomain };
