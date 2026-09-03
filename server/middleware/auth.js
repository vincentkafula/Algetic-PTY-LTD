const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Protects a route: requires a valid "Authorization: Bearer <token>" header
 * (issued by POST /api/auth/login or /api/auth/signup) and attaches the
 * decoded { id, email } to req.user.
 */
function requireAuth(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'Server is missing JWT_SECRET in .env' });
  }

  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // typ === undefined is accepted for backward compatibility with
    // sessions issued before this check existed — only an explicit,
    // different typ (e.g. "mailbox") is rejected. Anyone with an old
    // token keeps working until they next log in; a mailbox token can
    // never pass this check, old or new.
    if (payload.typ && payload.typ !== 'account') {
      return res.status(401).json({ error: 'This session is not an account session' });
    }
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session, please log in again' });
  }
}

module.exports = { requireAuth };
