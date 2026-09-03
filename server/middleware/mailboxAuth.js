const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// ---------------------------------------------------------------------------
// A SECOND, INDEPENDENT authentication system from middleware/auth.js.
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
// ---------------------------------------------------------------------------

function issueMailboxToken(mailbox) {
  return jwt.sign(
    { sub: mailbox.id, address: mailbox.address, ownerId: mailbox.ownerId, typ: 'mailbox' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function requireMailboxAuth(req, res, next) {
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
    if (payload.typ !== 'mailbox') {
      return res.status(401).json({ error: 'This session is not a mailbox session' });
    }
    req.mailbox = { id: payload.sub, address: payload.address, ownerId: payload.ownerId };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session, please log in again' });
  }
}

module.exports = { issueMailboxToken, requireMailboxAuth };
