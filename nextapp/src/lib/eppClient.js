const tls = require('tls');
const { XMLParser } = require('fast-xml-parser');
const { create } = require('xmlbuilder2');

// ---------------------------------------------------------------------------
// EPP (Extensible Provisioning Protocol) client - the protocol registrars
// use to talk directly to domain registries (Verisign for .com/.net, PIR
// for .org, etc.), per RFC 5730 (base protocol), RFC 5731 (domain
// commands), RFC 5734 (transport over TCP). Built directly from those
// RFCs' own published XML examples, not a third-party summary of them -
// every command below was verified against its RFC's exact example
// structure (including the domain: namespace prefix convention the RFCs
// themselves use, not just an equivalent default-namespace form) before
// being accepted as correct.
//
// HONEST SCOPE, stated plainly rather than implied: this is the GENERIC
// protocol layer only - the part that's the same for every registrar
// talking to every registry, based on public IETF standards. It is NOT
// connected to any real registry and CANNOT register a real domain as-is.
// To actually do that requires, in order:
//   1. Altegic becoming ICANN-accredited (a real business/legal/financial
//      process - see the research done alongside this).
//   2. Separately negotiating technical + contractual terms with EACH
//      registry to be sold (Verisign, PIR, etc.) - accreditation with
//      ICANN does not automatically connect to any registry.
//   3. Each registry issuing real, registry-specific connection details:
//      a host/port for their EPP server (registries do not share this
//      publicly - it's provided only to registrars they've approved), a
//      client TLS certificate for mutual authentication, and login
//      credentials.
//   4. Passing that registry's OT&E (Operational Test & Evaluation)
//      environment testing before being allowed to connect to production.
//   5. Registry-specific EPP extensions beyond this base RFC layer - each
//      registry commonly adds its own (e.g. Verisign's own extensions for
//      specific TLD policies) - not something publicly documented the way
//      the base RFCs are, and not implemented here.
//   6. Contact objects (RFC 5733) must exist at the registry BEFORE a
//      domain:create can reference them as registrant/admin/tech - contact
//      commands are not yet implemented here either, for the same reason:
//      no live registry exists yet to build and verify them against.
//
// This file exists so that once all of the above is real, connecting is a
// matter of configuration (host/port/cert/credentials below), not building
// the protocol layer from scratch under time pressure.
// ---------------------------------------------------------------------------

const EPP_XMLNS = 'urn:ietf:params:xml:ns:epp-1.0';
const DOMAIN_XMLNS = 'urn:ietf:params:xml:ns:domain-1.0';

function isEppConfigured() {
  return Boolean(process.env.EPP_HOST && process.env.EPP_PORT && process.env.EPP_CLIENT_ID && process.env.EPP_PASSWORD);
}

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// --- Transport layer (RFC 5734) -----------------------------------------
// EPP over TCP uses a 4-byte big-endian length header BEFORE each XML
// message, where the length INCLUDES the 4 header bytes themselves - easy
// to get subtly wrong (off-by-4), confirmed against RFC 5734 Section 4
// rather than assumed.

function frameMessage(xml) {
  const body = Buffer.from(xml, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32BE(body.length + 4, 0);
  return Buffer.concat([header, body]);
}

/**
 * Opens a TLS connection to a real registry's EPP server. Every
 * registry-specific detail (host, port, client cert/key for mutual TLS)
 * has to come from that registry directly once connected - none of this
 * exists yet for Altegic.
 */
function connect() {
  if (!isEppConfigured()) {
    const err = new Error('EPP is not configured - no registry connection exists yet. See this file\'s own header for what has to happen first.');
    err.status = 500;
    throw err;
  }
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: process.env.EPP_HOST,
      port: parseInt(process.env.EPP_PORT, 10),
      cert: process.env.EPP_CLIENT_CERT, // PEM, registry-issued
      key: process.env.EPP_CLIENT_KEY,   // PEM, registry-issued
      rejectUnauthorized: true,
    });
    socket.once('secureConnect', () => resolve(socket));
    socket.once('error', reject);
  });
}

function readMessage(socket) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let expectedLength = null;

    function onData(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      if (expectedLength === null && buffer.length >= 4) {
        expectedLength = buffer.readUInt32BE(0);
      }
      if (expectedLength !== null && buffer.length >= expectedLength) {
        socket.removeListener('data', onData);
        socket.removeListener('error', reject);
        const xml = buffer.subarray(4, expectedLength).toString('utf8');
        resolve(xmlParser.parse(xml));
      }
    }
    socket.on('data', onData);
    socket.once('error', reject);
  });
}

async function sendCommand(socket, xml) {
  socket.write(frameMessage(xml));
  return readMessage(socket);
}

function trid() {
  return `altegic-${Date.now()}`;
}

// --- Session commands (RFC 5730) -----------------------------------------

/**
 * Every EPP session starts with the server sending an unsolicited
 * <greeting> immediately on connect - read this first before sending
 * <login>, per RFC 5730 Section 2.4.
 */
async function readGreeting(socket) {
  return readMessage(socket);
}

function buildLoginXml(clientId, password) {
  return create({ version: '1.0', encoding: 'UTF-8' })
    .ele('epp', { xmlns: EPP_XMLNS })
    .ele('command')
    .ele('login')
    .ele('clID').txt(clientId).up()
    .ele('pw').txt(password).up()
    .ele('options')
    .ele('version').txt('1.0').up()
    .ele('lang').txt('en').up()
    .up()
    .ele('svcs')
    .ele('objURI').txt(DOMAIN_XMLNS).up()
    .up()
    .up()
    .ele('clTRID').txt(trid())
    .end({ prettyPrint: false });
}

async function login(socket) {
  return sendCommand(socket, buildLoginXml(process.env.EPP_CLIENT_ID, process.env.EPP_PASSWORD));
}

function buildLogoutXml() {
  return create({ version: '1.0', encoding: 'UTF-8' })
    .ele('epp', { xmlns: EPP_XMLNS })
    .ele('command')
    .ele('logout')
    .up()
    .ele('clTRID').txt(trid())
    .end({ prettyPrint: false });
}

async function logout(socket) {
  return sendCommand(socket, buildLogoutXml());
}

// --- Domain commands (RFC 5731) -------------------------------------------
// Every domain: element below uses the explicit xmlns:domain prefix
// convention RFC 5731's own examples use, not an equivalent
// default-namespace form - verified against each RFC example directly.

function buildDomainCheckXml(domains) {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('epp', { xmlns: EPP_XMLNS })
    .ele('command')
    .ele('check')
    .ele('domain:check', { 'xmlns:domain': DOMAIN_XMLNS });
  domains.forEach((d) => doc.ele('domain:name').txt(d).up());
  doc.up().up().ele('clTRID').txt(trid());
  return doc.end({ prettyPrint: false });
}

/** Checks whether one or more domains are available at the registry. */
async function checkDomains(socket, domains) {
  return sendCommand(socket, buildDomainCheckXml(domains));
}

function buildDomainInfoXml(domain) {
  return create({ version: '1.0', encoding: 'UTF-8' })
    .ele('epp', { xmlns: EPP_XMLNS })
    .ele('command')
    .ele('info')
    .ele('domain:info', { 'xmlns:domain': DOMAIN_XMLNS })
    .ele('domain:name').txt(domain).up()
    .up()
    .up()
    .ele('clTRID').txt(trid())
    .end({ prettyPrint: false });
}

/** Full registry record for a domain the caller is authorized to see. */
async function getDomainInfo(socket, domain) {
  return sendCommand(socket, buildDomainInfoXml(domain));
}

function buildDomainCreateXml({ domain, periodYears, nameservers, registrantId, adminId, techId, authInfo }) {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('epp', { xmlns: EPP_XMLNS })
    .ele('command')
    .ele('create')
    .ele('domain:create', { 'xmlns:domain': DOMAIN_XMLNS })
    .ele('domain:name').txt(domain).up()
    .ele('domain:period', { unit: 'y' }).txt(String(periodYears || 1)).up();
  if (nameservers && nameservers.length) {
    const ns = doc.ele('domain:ns');
    nameservers.forEach((n) => ns.ele('domain:hostObj').txt(n).up());
    ns.up();
  }
  doc.ele('domain:registrant').txt(registrantId).up();
  if (adminId) doc.ele('domain:contact', { type: 'admin' }).txt(adminId).up();
  if (techId) doc.ele('domain:contact', { type: 'tech' }).txt(techId).up();
  doc.ele('domain:authInfo').ele('domain:pw').txt(authInfo).up().up();
  doc.up().up().ele('clTRID').txt(trid());
  return doc.end({ prettyPrint: false });
}

/**
 * Registers a domain at the registry. Requires registrant/admin/tech
 * CONTACT OBJECTS to already exist at that registry (RFC 5733) - contact
 * creation is a separate command not yet implemented here, since there is
 * no live registry to create or test contacts against yet either.
 */
async function createDomain(socket, params) {
  return sendCommand(socket, buildDomainCreateXml(params));
}

function buildDomainRenewXml(domain, currentExpiryDate, periodYears) {
  return create({ version: '1.0', encoding: 'UTF-8' })
    .ele('epp', { xmlns: EPP_XMLNS })
    .ele('command')
    .ele('renew')
    .ele('domain:renew', { 'xmlns:domain': DOMAIN_XMLNS })
    .ele('domain:name').txt(domain).up()
    .ele('domain:curExpDate').txt(currentExpiryDate).up() // YYYY-MM-DD, required so the registry can detect a stale/conflicting renewal
    .ele('domain:period', { unit: 'y' }).txt(String(periodYears || 1)).up()
    .up()
    .up()
    .ele('clTRID').txt(trid())
    .end({ prettyPrint: false });
}

async function renewDomain(socket, domain, currentExpiryDate, periodYears) {
  return sendCommand(socket, buildDomainRenewXml(domain, currentExpiryDate, periodYears));
}

module.exports = {
  isEppConfigured,
  connect,
  readGreeting,
  login,
  logout,
  checkDomains,
  getDomainInfo,
  createDomain,
  renewDomain,
  // Exported for testing/inspection without a live registry connection -
  // these are pure functions that just build XML strings.
  buildLoginXml,
  buildLogoutXml,
  buildDomainCheckXml,
  buildDomainInfoXml,
  buildDomainCreateXml,
  buildDomainRenewXml,
};
