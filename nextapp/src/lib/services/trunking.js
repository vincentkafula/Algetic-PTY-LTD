const crypto = require('crypto');
const { twilioClient, isTwilioConfigured } = require('../twilioClient');
const db = require('../db');

// ---------------------------------------------------------------------------
// Ported from server/services/trunking.js — no Express-specific code, so
// nothing needed adapting beyond the require paths.
//
// One dedicated Twilio Elastic SIP Trunk per customer account.
//
// Every account gets its own Trunk + Credential List (its own SIP username
// and password), so one customer's compromised or misconfigured SIP device
// can never place calls billed to another customer's account.
//
// IMPORTANT — read before wiring this into a UI that promises "any IP phone
// can just register":
// Twilio Elastic SIP Trunking (the `trunking.v1.trunks` API used here) does
// NOT accept SIP REGISTER requests. A trunk receives inbound calls only at
// a static "origination URI" you configure — the public address of a PBX,
// session border controller, or a softphone with a stable, reachable SIP
// address. There is no step that turns an arbitrary softphone with no
// public address into a working endpoint just by handing it a username and
// password. (The Team Calling feature, ported in a later phase, uses a
// genuinely different Twilio product — Programmable Voice SIP Domains —
// specifically to cover that registration-based case.)
// ---------------------------------------------------------------------------

function assertConfigured() {
  if (!isTwilioConfigured()) {
    const err = new Error('Server is missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in .env');
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

function domainForAccount(ownerId) {
  const suffix = randomToken(6).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8);
  return `altegic-${suffix}.pstn.twilio.com`;
}

function publicTrunk(record) {
  return {
    id: record.id,
    trunkSid: record.trunkSid,
    domainName: record.domainName,
    sipUsername: record.sipUsername,
    originationUri: record.originationUri || null,
    createdAt: record.createdAt
  };
}

/**
 * Returns the account's trunk record, creating the Trunk + Credential List
 * in Twilio on first call. Returns { record, generatedPassword } —
 * generatedPassword is only non-null the first time a trunk is created for
 * this account, since Twilio (like this app) never stores the password in
 * a way that can be read back later.
 */
async function ensureTrunkForAccount(ownerId) {
  assertConfigured();

  const existing = db.trunks.find((t) => t.ownerId === ownerId);
  if (existing) return { record: existing, generatedPassword: null };

  const domainName = domainForAccount(ownerId);
  const username = `cust_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const password = generatePassword();

  const trunk = await twilioClient.trunking.v1.trunks.create({
    friendlyName: `Altegic account ${ownerId}`,
    domainName
  });

  const credentialList = await twilioClient.sip.credentialLists.create({
    friendlyName: `altegic-${ownerId}`
  });

  await twilioClient.sip.credentialLists(credentialList.sid).credentials.create({
    username,
    password
  });

  await twilioClient.trunking.v1.trunks(trunk.sid).credentialsLists.create({
    credentialListSid: credentialList.sid
  });

  const record = {
    id: crypto.randomUUID(),
    ownerId,
    trunkSid: trunk.sid,
    domainName: trunk.domainName,
    credentialListSid: credentialList.sid,
    sipUsername: username,
    originationUri: null,
    createdAt: new Date().toISOString()
  };
  await db.trunks.insert(record);

  return { record, generatedPassword: password };
}

/**
 * Associates a purchased phone number with the account's trunk so inbound
 * calls to that number route to whatever origination URI the trunk has
 * configured.
 */
async function attachNumberToTrunk(trunkSid, phoneNumberSid) {
  assertConfigured();
  await twilioClient.trunking.v1.trunks(trunkSid).phoneNumbers.create({ phoneNumberSid });
}

/**
 * Sets (replacing any previous value) the single origination URI calls are
 * delivered to — the customer's PBX/SBC/softphone public SIP address.
 */
async function setOriginationUri(ownerId, sipUri) {
  assertConfigured();
  if (!/^sips?:[^\s]+$/i.test(sipUri)) {
    const err = new Error('originationUri must be a SIP URI, e.g. sip:203.0.113.10:5060');
    err.status = 400;
    throw err;
  }

  const record = db.trunks.find((t) => t.ownerId === ownerId);
  if (!record) {
    const err = new Error('No trunk exists for this account yet — provision a number first');
    err.status = 404;
    throw err;
  }

  const existingUrls = await twilioClient.trunking.v1.trunks(record.trunkSid).originationUrls.list();
  for (const url of existingUrls) {
    await twilioClient.trunking.v1.trunks(record.trunkSid).originationUrls(url.sid).remove();
  }

  await twilioClient.trunking.v1.trunks(record.trunkSid).originationUrls.create({
    friendlyName: 'Primary endpoint',
    sipUrl: sipUri,
    weight: 1,
    priority: 1,
    enabled: true
  });

  return db.trunks.update((t) => t.id === record.id, { originationUri: sipUri });
}

/**
 * Regenerates the SIP credential for an account's trunk (deletes the old
 * credential, creates a new one) and returns the new password once.
 */
async function resetCredential(ownerId) {
  assertConfigured();
  const record = db.trunks.find((t) => t.ownerId === ownerId);
  if (!record) {
    const err = new Error('No trunk exists for this account yet — provision a number first');
    err.status = 404;
    throw err;
  }

  const existingCreds = await twilioClient.sip.credentialLists(record.credentialListSid).credentials.list();
  for (const cred of existingCreds) {
    await twilioClient.sip.credentialLists(record.credentialListSid).credentials(cred.sid).remove();
  }

  const username = `cust_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const password = generatePassword();
  await twilioClient.sip.credentialLists(record.credentialListSid).credentials.create({ username, password });

  const updated = await db.trunks.update((t) => t.id === record.id, { sipUsername: username });
  return { record: updated, generatedPassword: password };
}

/**
 * Actually purchases a Twilio number, attaches it to the account's SIP
 * trunk, and creates the local record — the real provisioning work,
 * called from the ITN webhook once PayFast confirms payment (the
 * numbers Route Handler's provision endpoint only creates a payment
 * order — see that file for why).
 */
async function provisionNumberForAccount(ownerId, phoneNumber, customerLabel) {
  const bought = await twilioClient.incomingPhoneNumbers.create({ phoneNumber });

  try {
    const { record: trunk, generatedPassword } = await ensureTrunkForAccount(ownerId);
    await attachNumberToTrunk(trunk.trunkSid, bought.sid);

    const record = {
      id: crypto.randomUUID(),
      ownerId,
      phoneNumber: bought.phoneNumber,
      twilioSid: bought.sid,
      customerLabel: customerLabel || null,
      provisionedAt: new Date().toISOString(),
      trunkId: trunk.id,
      sipSetup: {
        domain: trunk.domainName,
        username: trunk.sipUsername,
        password: generatedPassword,
        passwordNote: generatedPassword
          ? 'Save this now — it will not be shown again. Use trunk/reset-password to issue a new one later.'
          : 'This number uses your account\'s existing trunk credentials, issued when you provisioned your first number. Use trunk/reset-password if you need a new password.',
        inboundNote: 'Inbound calls to this number reach your registered SIP endpoint once you set an origination address via trunk/origination — see the SIP Trunk panel.'
      }
    };
    await db.numbers.insert(record);
    return record;
  } catch (err) {
    // The number was already purchased in Twilio at this point — and,
    // unlike the pre-payment version of this flow, the customer has
    // ALSO already paid. Roll back the Twilio purchase so it isn't
    // orphaned and billed forever, but the payment itself still needs a
    // human to notice (the order is marked fulfillment_failed by the
    // caller) — there is no automatic refund built here.
    try {
      await twilioClient.incomingPhoneNumbers(bought.sid).remove();
    } catch (cleanupErr) {
      console.error('Failed to roll back purchased number after trunk error:', cleanupErr.message);
    }
    throw err;
  }
}

module.exports = {
  ensureTrunkForAccount,
  attachNumberToTrunk,
  setOriginationUri,
  resetCredential,
  publicTrunk,
  provisionNumberForAccount
};
