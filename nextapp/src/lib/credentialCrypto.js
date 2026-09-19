const crypto = require('crypto');

// ---------------------------------------------------------------------------
// For secrets this app must retrieve in plaintext later (e.g. a mailbox's
// own Mailcow SMTP/IMAP password, needed on every send/fetch) — hashing
// (bcrypt, as used for webmailPasswordHash) doesn't work, since a hash
// can't be reversed. Plaintext storage in this app's JSON file store would
// be a real step backward given everything else here already flags that
// store as not production-hardened (see db.js's own header). AES-256-GCM
// with a key from MAILCOW_CREDENTIAL_ENCRYPTION_KEY is a meaningful
// improvement over plaintext — genuinely unreadable without the key — but
// is still not a substitute for a real secrets manager (Vault, AWS
// Secrets Manager, etc.) in an actual production deployment. Said plainly
// here rather than presented as a complete solution.
// ---------------------------------------------------------------------------

function getKey() {
  const raw = process.env.MAILCOW_CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    const err = new Error('Server is missing MAILCOW_CREDENTIAL_ENCRYPTION_KEY in .env');
    err.status = 500;
    throw err;
  }
  // Accepts any string; hashed to a fixed 32-byte key so the .env value
  // itself doesn't need to be a precisely-formatted hex/base64 string.
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptSecret(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decryptSecret(stored) {
  const key = getKey();
  const [ivB64, authTagB64, dataB64] = stored.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encryptSecret, decryptSecret };
