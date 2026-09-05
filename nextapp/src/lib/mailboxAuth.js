const jwt = require('jsonwebtoken');

// ---------------------------------------------------------------------------
// Ported from server/middleware/mailboxAuth.js. A SECOND, INDEPENDENT
// authentication system from src/lib/auth.js.
//
// An Altegic account (a reseller) manages mailboxes, numbers, domains, etc.
// A mailbox login is a completely different thing: the actual end customer
// who owns sales@theirdomain.com, logging into their own webmail — they
// have no access to, and no knowledge of, the Altegic reseller account that
// provisioned their mailbox.
//
// Both token types are signed with the same JWT_SECRET (no reason to manage
// two secrets), but carry a `typ` claim so one can never be used as the
// other — a stolen mailbox token should never grant access to the reseller
// dashboard, and vice versa. requireMailboxAuth checks `typ` explicitly and
// rejects anything that isn't exactly "mailbox".
//
// Same Next.js adaptation as src/lib/auth.js: a callable helper each
// protected Route Handler invokes itself, not an Express middleware chain.
// ---------------------------------------------------------------------------

function mailboxAuthError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function issueMailboxToken(mailbox) {
  const JWT_SECRET = process.env.JWT_SECRET;
  return jwt.sign(
    { sub: mailbox.id, address: mailbox.address, ownerId: mailbox.ownerId, typ: 'mailbox' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Requires a valid mailbox-session "Authorization: Bearer <token>" header
 * (issued by POST /api/webmail/login) and returns
 * { id, address, ownerId }. Throws on any failure — callers must catch.
 */
function requireMailboxAuth(request) {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw mailboxAuthError('Server is missing JWT_SECRET in .env', 500);
  }

  const header = request.headers.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw mailboxAuthError('Missing or malformed Authorization header', 401);
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw mailboxAuthError('Invalid or expired session, please log in again', 401);
  }

  if (payload.typ !== 'mailbox') {
    throw mailboxAuthError('This session is not a mailbox session', 401);
  }

  return { id: payload.sub, address: payload.address, ownerId: payload.ownerId };
}

module.exports = { issueMailboxToken, requireMailboxAuth };
