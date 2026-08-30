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
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session, please log in again' });
  }
}

module.exports = { requireAuth };
