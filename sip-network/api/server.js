const express = require('express');
const crypto = require('crypto');
const Database = require('better-sqlite3');

// ---------------------------------------------------------------------------
// SIP subscriber management API.
//
// Runs as its own container on the same VPS as Kamailio, sharing the
// kamailio-data volume so it reads/writes the exact same SQLite database
// Kamailio itself uses (the same file manage_subscribers.py touches — this
// service exists so CommHub's dashboard can do the same thing over HTTPS
// instead of you SSHing in and running that script by hand).
//
// SCOPING NOTE: unlike CommHub's mailboxes/numbers (which are isolated per
// customer account), SIP subscribers here are NOT scoped to any CommHub
// account. This is a single shared subscriber list for one private network
// — appropriate for "my own team's calling system," not for reselling
// separate isolated networks to different customers. If you ever need
// that, you'd add an account-tag column to the subscriber table and filter
// by it throughout this file.
//
// Auth: a single shared API key (SIP_API_KEY), checked via a constant-time
// comparison. This is simpler than CommHub's per-user JWT sessions because
// there's exactly one caller (the CommHub backend) — but that also means
// this key is as sensitive as a root password for the subscriber list.
// This service MUST sit behind TLS in production — see the bundled Caddy
// reverse proxy in docker-compose.yml. Running it over plain HTTP would
// send SIP passwords across the network in the clear.
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '/etc/kamailio/kamailio.db';
const SIP_API_KEY = process.env.SIP_API_KEY;
const SIP_DOMAIN = process.env.SIP_DOMAIN;

if (!SIP_API_KEY) {
  console.error('FATAL: SIP_API_KEY is not set. Refusing to start unauthenticated.');
  process.exit(1);
}
if (!SIP_DOMAIN) {
  console.error('FATAL: SIP_DOMAIN is not set.');
  process.exit(1);
}

const app = express();
app.use(express.json());

function requireApiKey(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  const provided = Buffer.from(token);
  const expected = Buffer.from(SIP_API_KEY);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

function ha1(username, domain, password) {
  return crypto.createHash('md5').update(`${username}:${domain}:${password}`).digest('hex');
}
function ha1b(username, domain, password) {
  return crypto.createHash('md5').update(`${username}@${domain}:${domain}:${password}`).digest('hex');
}

function getDb() {
  // Opened per-request rather than held open: this file is also written
  // by Kamailio itself in a separate process, and better-sqlite3's
  // default journal mode handles that fine for the low write volume a
  // subscriber-management API sees (nothing like call/registration
  // traffic, which never touches this process at all).
  return new Database(DB_PATH);
}

app.get('/health', (req, res) => {
  res.json({ ok: true, domain: SIP_DOMAIN });
});

app.use(requireApiKey);

/**
 * GET /subscribers
 */
app.get('/subscribers', (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare('SELECT username FROM subscriber WHERE domain = ? ORDER BY username').all(SIP_DOMAIN);
    res.json({ domain: SIP_DOMAIN, subscribers: rows.map((r) => r.username) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

/**
 * POST /subscribers
 * body: { username, password }
 * Creates a subscriber, or updates the password if it already exists.
 */
app.post('/subscribers', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return res.status(400).json({ error: 'username can only contain letters, numbers, dots, dashes and underscores' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  const db = getDb();
  try {
    const h1 = ha1(username, SIP_DOMAIN, password);
    const h1b = ha1b(username, SIP_DOMAIN, password);

    const existing = db.prepare('SELECT id FROM subscriber WHERE username = ? AND domain = ?').get(username, SIP_DOMAIN);
    if (existing) {
      db.prepare('UPDATE subscriber SET password = ?, ha1 = ?, ha1b = ? WHERE id = ?').run(password, h1, h1b, existing.id);
      return res.json({ username, domain: SIP_DOMAIN, updated: true });
    }
    db.prepare('INSERT INTO subscriber (username, domain, password, ha1, ha1b) VALUES (?,?,?,?,?)')
      .run(username, SIP_DOMAIN, password, h1, h1b);
    res.status(201).json({ username, domain: SIP_DOMAIN, created: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

/**
 * DELETE /subscribers/:username
 */
app.delete('/subscribers/:username', (req, res) => {
  const db = getDb();
  try {
    const result = db.prepare('DELETE FROM subscriber WHERE username = ? AND domain = ?').run(req.params.username, SIP_DOMAIN);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(PORT, () => {
  console.log(`SIP management API running on port ${PORT} for domain ${SIP_DOMAIN}`);
});
