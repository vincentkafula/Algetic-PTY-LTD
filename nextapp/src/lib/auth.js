const jwt = require('jsonwebtoken');

// ---------------------------------------------------------------------------
// Ported from server/middleware/auth.js. Next.js Route Handlers don't chain
// Express-style middleware — the conventional pattern instead is a helper
// each protected route calls explicitly at its own top. Throws an Error
// with a `.status` property on failure; callers catch it and turn it into
// a NextResponse (see any route.js under app/api/ for the pattern).
//
// Note: no `require('dotenv').config()` here or anywhere else in this
// project — Next.js loads .env / .env.local automatically, unlike the
// Express app this was ported from.
// ---------------------------------------------------------------------------

function authError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Requires a valid "Authorization: Bearer <token>" header (issued by
 * POST /api/auth/login or /api/auth/signup) and returns the decoded
 * { id, email }. Throws on any failure — callers must catch.
 */
function requireAuth(req) {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw authError('Server is missing JWT_SECRET in .env', 500);
  }

  const header = req.headers.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw authError('Missing or malformed Authorization header', 401);
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw authError('Invalid or expired session, please log in again', 401);
  }

  // typ === undefined is accepted for backward compatibility with sessions
  // issued before this check existed — only an explicit, different typ
  // (e.g. "mailbox") is rejected.
  if (payload.typ && payload.typ !== 'account') {
    throw authError('This session is not an account session', 401);
  }

  // role === undefined is the same backward-compatibility case — a
  // session issued before roles existed. Treated as 'purchasing' (the
  // default role every account effectively had before this system
  // existed) rather than throwing, so an existing logged-in session
  // doesn't get abruptly logged out by this change.
  return { id: payload.sub, email: payload.email, role: payload.role || 'purchasing' };
}

/**
 * Requires the caller to be logged in AND hold one of the given roles.
 * Throws 403 (not 401) if logged in but the wrong role — a real,
 * meaningful distinction for the caller: 401 means "log in again", 403
 * means "you're logged in, but this isn't for you."
 */
function requireRole(req, allowedRoles) {
  const user = requireAuth(req);
  if (!allowedRoles.includes(user.role)) {
    throw authError('Your account does not have access to this', 403);
  }
  return user;
}

module.exports = { requireAuth, requireRole };
