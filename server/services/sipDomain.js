const crypto = require('crypto');
const { twilioClient, isTwilioConfigured } = require('../twilioClient');
const { PUBLIC_BASE_URL } = require('../mailgunClient');
const db = require('../db');

// ---------------------------------------------------------------------------
// Team calling on Twilio's real public network — a SIP Domain with
// registration-based credential auth. This is the "different Twilio
// product" flagged in services/trunking.js's own comments: Elastic SIP
// Trunking (used for the Voice/numbers feature) can't accept a plain SIP
// REGISTER from an arbitrary softphone; a SIP Domain can. Replaces the
// self-hosted Kamailio system entirely — no VPS, no Docker, no NAT
// traversal to debug. Every credential here is real, checkable against
// Twilio's own account, not a local password file on someone's server.
//
// One Domain + one CredentialList per account (mirroring the one-Trunk-
// per-account isolation in trunking.js) — a compromised or leaked
// credential on one account can never be used to place calls billed to
// another account.
// ---------------------------------------------------------------------------

function assertConfigured() {
  if (!isTwilioConfigured()) {
    const err = new Error('Server is missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in .env');
    err.status = 500;
    throw err;
  }
  if (!PUBLIC_BASE_URL) {
    const err = new Error('Server is missing PUBLIC_BASE_URL in .env — required so Twilio can reach this server\'s webhook');
    err.status = 500;
    throw err;
  }
}

function randomToken(bytes) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function generatePassword() {
  return randomToken(24);
}

function domainNameForAccount() {
  // Must be globally unique across ALL Twilio accounts, not just this
  // app's — and must end in sip.twilio.com (a SIP Domain, not a Trunk;
  // trunk domains end in pstn.twilio.com instead, a different resource).
  const suffix = randomToken(8).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 10);
  return `altegic-team-${suffix}.sip.twilio.com`;
}

function sanitizeUsername(username) {
  // Twilio SIP credential usernames: letters, digits, some punctuation.
  // Keep it simple and predictable — this also becomes part of a real
  // SIP address (username@domain), so no spaces or @ signs.
  return String(username).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

function publicDomain(record) {
  return {
    id: record.id,
    domainSid: record.domainSid,
    domainName: record.domainName,
    createdAt: record.createdAt
  };
}

/**
 * Returns the account's SIP Domain record, creating the Domain +
 * CredentialList (mapped to BOTH registration and outbound-call auth) on
 * first call. The voiceUrl points at this account's webhook — Twilio
 * calls it for every SIP request that touches the domain, whether a
 * registered softphone dialing out to the PSTN, or an inbound request
 * trying to reach a specific registered username.
 */
async function ensureDomainForAccount(ownerId) {
  assertConfigured();

  const existing = db.sipDomains.find((d) => d.ownerId === ownerId);
  if (existing) return existing;

  const domainName = domainNameForAccount();
  const voiceUrl = `${PUBLIC_BASE_URL}/api/webhooks/twilio/team-voice`;

  const domain = await twilioClient.sip.domains.create({
    domainName,
    friendlyName: `Altegic account ${ownerId}`,
    voiceUrl,
    voiceMethod: 'POST',
    sipRegistration: true
  });

  const credentialList = await twilioClient.sip.credentialLists.create({
    friendlyName: `altegic-team-${ownerId}`
  });

  // Both mappings are required: registration auth lets a softphone
  // REGISTER with these credentials; calls auth lets that same
  // registered device place authenticated outbound calls (otherwise it
  // could receive calls but never dial out).
  await twilioClient.sip.domains(domain.sid).auth.registrations.credentialListMappings.create({
    credentialListSid: credentialList.sid
  });
  await twilioClient.sip.domains(domain.sid).auth.calls.credentialListMappings.create({
    credentialListSid: credentialList.sid
  });

  const record = {
    id: crypto.randomUUID(),
    ownerId,
    domainSid: domain.sid,
    domainName: domain.domainName,
    credentialListSid: credentialList.sid,
    createdAt: new Date().toISOString()
  };
  await db.sipDomains.insert(record);
  return record;
}

/**
 * Adds a team member (a real Twilio SIP credential) or, if the username
 * already exists for this account, resets their password instead of
 * erroring — Twilio credential usernames are unique per CredentialList,
 * so "add" and "reset" share this one path, same as how re-adding an
 * existing username was handled in the self-hosted system this replaces.
 * Returns { username, password, created } — password is only ever
 * returned here, at creation/reset time, never stored in a way that can
 * be read back later.
 */
async function addOrResetMember(ownerId, rawUsername, password) {
  assertConfigured();
  const username = sanitizeUsername(rawUsername);
  if (!username) {
    const err = new Error('username is required');
    err.status = 400;
    throw err;
  }

  const domainRecord = await ensureDomainForAccount(ownerId);

  const existing = await twilioClient.sip.credentialLists(domainRecord.credentialListSid).credentials.list();
  const match = existing.find((c) => c.username === username);

  if (match) {
    await twilioClient.sip.credentialLists(domainRecord.credentialListSid).credentials(match.sid).update({ password });
    return { username, created: false };
  }

  await twilioClient.sip.credentialLists(domainRecord.credentialListSid).credentials.create({ username, password });
  return { username, created: true };
}

/**
 * Lists this account's team members (SIP credential usernames) — Twilio
 * never returns passwords back, by design, matching this app's own
 * shown-once discipline for every other credential.
 */
async function listMembers(ownerId) {
  assertConfigured();
  const domainRecord = db.sipDomains.find((d) => d.ownerId === ownerId);
  if (!domainRecord) return { domainName: null, members: [] };

  const credentials = await twilioClient.sip.credentialLists(domainRecord.credentialListSid).credentials.list();
  return {
    domainName: domainRecord.domainName,
    members: credentials.map((c) => c.username)
  };
}

async function removeMember(ownerId, rawUsername) {
  assertConfigured();
  const username = sanitizeUsername(rawUsername);
  const domainRecord = db.sipDomains.find((d) => d.ownerId === ownerId);
  if (!domainRecord) {
    const err = new Error('No team calling domain exists for this account yet');
    err.status = 404;
    throw err;
  }

  const existing = await twilioClient.sip.credentialLists(domainRecord.credentialListSid).credentials.list();
  const match = existing.find((c) => c.username === username);
  if (!match) {
    const err = new Error('No such team member');
    err.status = 404;
    throw err;
  }
  await twilioClient.sip.credentialLists(domainRecord.credentialListSid).credentials(match.sid).remove();
}

module.exports = {
  ensureDomainForAccount,
  addOrResetMember,
  listMembers,
  removeMember,
  publicDomain
};
