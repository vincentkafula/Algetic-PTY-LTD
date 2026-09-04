const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { GODADDY_BASE_URL, isGoDaddyConfigured, authHeader, getGoDaddyQuote } = require('../godaddyClient');
const pricing = require('../services/pricing');
const { createOrderWithCheckout } = require('../services/orders');

// ---------------------------------------------------------------------------
// Domain registration via GoDaddy's v3 "quote-execute" API, now gated
// behind real customer payment (see services/orders.js, services/payfast.js).
// Scoped per Altegic account, same as mailboxes/numbers.
//
// FLOW: search (free, no charge) -> quote (shows the customer's real ZAR
// price, already converted + marked up — never GoDaddy's raw USD price)
// -> register (creates a payment order + PayFast checkout; does NOT
// register anything itself). The actual GoDaddy registration call only
// happens in routes/paymentWebhooks.js, once PayFast confirms payment —
// and even then, against a freshly-fetched GoDaddy quote at that moment,
// not whichever one was shown to the customer earlier. Registering a
// domain charges Altegic's own GoDaddy payment profile and is NOT
// reversible (GoDaddy's own words, in their developer docs) — this is
// why every price used to actually register is fetched fresh, never
// trusted from an earlier step or from the client.
// ---------------------------------------------------------------------------

router.use(requireAuth);

function assertConfigured(res) {
  if (!isGoDaddyConfigured()) {
    res.status(500).json({ error: 'Server is missing GODADDY_PAT in .env' });
    return false;
  }
  return true;
}

/**
 * GET /api/domains/search?domain=example.com
 * Read-only availability + indicative pricing check. No charges, no
 * account interaction on GoDaddy's side beyond the lookup itself.
 */
router.get('/search', async (req, res) => {
  if (!assertConfigured(res)) return;
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'domain query param is required' });

  try {
    const url = new URL(`${GODADDY_BASE_URL}/domains/check-availability`);
    url.searchParams.set('domain', domain);
    const response = await fetch(url, { headers: { Authorization: authHeader() } });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.message || 'GoDaddy error', data });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/domains/suggestions?query=my+bakery&tlds=com,net
 * Natural-language / keyword domain name suggestions.
 */
router.get('/suggestions', async (req, res) => {
  if (!assertConfigured(res)) return;
  const { query, tlds } = req.query;

  try {
    const url = new URL(`${GODADDY_BASE_URL}/domains/suggestions`);
    if (query) url.searchParams.set('query', query);
    if (tlds) url.searchParams.set('tlds', tlds);
    url.searchParams.set('pageSize', '10');
    const response = await fetch(url, { headers: { Authorization: authHeader() } });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.message || 'GoDaddy error', data });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/domains/quote
 * body: { domain, period }
 * Locks a price and returns a short-lived, single-use quoteToken plus
 * requiredAgreements — the frontend MUST display the price and every
 * required agreement, and get an explicit confirmation, before calling
 * POST /register with this token. This route itself makes no charge and
 * commits to nothing.
 */
/**
 * POST /api/domains/quote
 * body: { domain, period }
 * Returns what the CUSTOMER would pay — already converted to ZAR and
 * marked up — never GoDaddy's raw USD price. Deliberately does not
 * return a quoteToken to the frontend either: the actual order-creation
 * step below fetches its own fresh quote right before charging anyone,
 * rather than reusing one that could be stale by then. This endpoint
 * exists purely to show a price and the required agreements up front.
 */
router.post('/quote', async (req, res) => {
  if (!assertConfigured(res)) return;
  const { domain, period } = req.body || {};
  if (!domain) return res.status(400).json({ error: 'domain is required' });

  try {
    const quote = await getGoDaddyQuote(domain, period || 1);
    const price = await pricing.priceForCustomer(quote.price.value);
    res.json({
      domain,
      period: period || 1,
      customerPriceCents: price.customerZarCents,
      customerPriceFormatted: pricing.formatZarCents(price.customerZarCents),
      expiresAt: quote.expiresAt,
      requiredAgreements: quote.requiredAgreements || quote.agreements || []
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, data: err.data });
  }
});

/**
 * POST /api/domains/register
 * body: { domain, period, agreedAgreementTypes }
 * Does NOT register anything directly anymore — creates a payment order
 * and returns PayFast checkout details. The actual GoDaddy registration
 * happens in routes/paymentWebhooks.js once payment is confirmed, using
 * a freshly-fetched quote at that point (not whatever was quoted here).
 *
 * Still refetches its own quote here too, rather than trusting a price
 * the client might supply — a client-supplied baseUsdCents would let
 * someone tamper with what they're charged while still receiving a
 * domain worth more. This is the ONLY price this endpoint trusts: what
 * GoDaddy itself says, fetched server-side, right now.
 */
router.post('/register', async (req, res) => {
  if (!assertConfigured(res)) return;
  const { domain, period, agreedAgreementTypes } = req.body || {};
  if (!domain) return res.status(400).json({ error: 'domain is required' });
  if (!Array.isArray(agreedAgreementTypes) || agreedAgreementTypes.length === 0) {
    return res.status(400).json({ error: 'agreedAgreementTypes must list every agreement the customer confirmed — no order was created' });
  }

  try {
    const quote = await getGoDaddyQuote(domain, period || 1);
    const result = await createOrderWithCheckout({
      ownerId: req.user.id,
      ownerEmail: req.user.email,
      fulfillmentType: 'domain',
      fulfillmentData: { domain, period: period || 1, agreedAgreementTypes },
      baseUsdCents: quote.price.value,
      itemName: domain,
      itemDescription: `Domain registration: ${domain}`
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, data: err.data });
  }
});

/**
 * GET /api/domains
 * List domains this account has registered through Altegic.
 */
router.get('/', (req, res) => {
  const domains = db.domains.filter((d) => d.ownerId === req.user.id);
  res.json({ domains });
});

/**
 * GET /api/domains/:id/status
 * Polls GoDaddy for the current status of a pending registration and
 * updates the local record. Registration is async on GoDaddy's side —
 * a 202 from /register doesn't mean the domain is live yet.
 */
router.get('/:id/status', async (req, res) => {
  const domain = db.domains.find((d) => d.id === req.params.id && d.ownerId === req.user.id);
  if (!domain) return res.status(404).json({ error: 'Domain not found' });
  if (!assertConfigured(res)) return;
  if (!domain.godaddyPollUrl) {
    return res.json(domain); // Nothing to poll — return what we have.
  }

  try {
    const response = await fetch(domain.godaddyPollUrl, { headers: { Authorization: authHeader() } });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.message || 'GoDaddy error', data });

    const updated = await db.domains.update((d) => d.id === domain.id, { status: data.status || domain.status });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== DNS records =====
//
// SECURITY: GODADDY_PAT is one shared credential for the whole Altegic
// deployment, covering every domain in that GoDaddy account — not scoped
// per Altegic customer the way Twilio/Mailgun credentials effectively are
// per-resource. Every DNS route below therefore requires :id to match a
// domain record this specific account registered THROUGH Altegic (in
// db.domains), not just any domain string. Without this check, any
// Altegic account could edit DNS for any domain in the underlying
// GoDaddy account, including ones belonging to other Altegic customers.
// Domains registered directly in GoDaddy (outside Altegic) are not
// manageable here at all — there's no local record to match against.

function findOwnedDomain(req, res) {
  const domain = db.domains.find((d) => d.id === req.params.id && d.ownerId === req.user.id);
  if (!domain) {
    res.status(404).json({ error: 'Domain not found on your account — only domains registered through Altegic can be managed here' });
    return null;
  }
  return domain;
}

/**
 * GET /api/domains/:id/dns?type=A&name=www
 * Lists DNS records for this domain. type/name filter is optional.
 */
router.get('/:id/dns', async (req, res) => {
  const domain = findOwnedDomain(req, res);
  if (!domain) return;
  if (!assertConfigured(res)) return;

  try {
    const url = new URL(`${GODADDY_BASE_URL}/domains/zones/${domain.domain}/dns-records`);
    if (req.query.type) url.searchParams.set('type', req.query.type);
    if (req.query.name) url.searchParams.set('name', req.query.name);
    const response = await fetch(url, { headers: { Authorization: authHeader() } });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.message || 'GoDaddy error', data });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/domains/:id/dns
 * body: { type, name, data, ttl }
 * Appends a record. GoDaddy rejects this if an identical record already
 * exists, or if it would conflict with an existing one (e.g. a CNAME at
 * the apex, or a CNAME alongside an A record for the same name) — that
 * rejection is passed through as-is rather than papered over.
 */
router.post('/:id/dns', async (req, res) => {
  const domain = findOwnedDomain(req, res);
  if (!domain) return;
  if (!assertConfigured(res)) return;

  const { type, name, data: recordData, ttl } = req.body || {};
  if (!type || !name || !recordData) {
    return res.status(400).json({ error: 'type, name, and data are all required' });
  }

  try {
    const response = await fetch(`${GODADDY_BASE_URL}/domains/zones/${domain.domain}/dns-records`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{ type, name, data: recordData, ttl: ttl || 600 }])
    });
    if (response.status === 204 || response.status === 200) {
      return res.status(201).json({ type, name, data: recordData, ttl: ttl || 600 });
    }
    const data = await response.json();
    res.status(response.status).json({ error: data.message || 'GoDaddy error', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/domains/:id/dns/:type/:name
 * body: { records: [{ data, ttl }, ...] }
 * Replaces every record of this type+name in one call — the safe way to
 * "update" a record (POST only appends and will reject a duplicate).
 */
router.put('/:id/dns/:type/:name', async (req, res) => {
  const domain = findOwnedDomain(req, res);
  if (!domain) return;
  if (!assertConfigured(res)) return;

  const { records } = req.body || {};
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records must be a non-empty array of { data, ttl }' });
  }

  try {
    const response = await fetch(
      `${GODADDY_BASE_URL}/domains/zones/${domain.domain}/dns-records/${req.params.type}/${req.params.name}`,
      {
        method: 'PUT',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(records)
      }
    );
    if (response.status === 204 || response.status === 200) {
      return res.json({ type: req.params.type, name: req.params.name, records });
    }
    const data = await response.json();
    res.status(response.status).json({ error: data.message || 'GoDaddy error', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/domains/:id/dns/:type/:name
 * Removes every record of this type+name (GoDaddy has no single-record
 * delete-by-id in the zone endpoint — deletion is by type+name, same
 * granularity as the replace operation above).
 */
router.delete('/:id/dns/:type/:name', async (req, res) => {
  const domain = findOwnedDomain(req, res);
  if (!domain) return;
  if (!assertConfigured(res)) return;

  try {
    const response = await fetch(
      `${GODADDY_BASE_URL}/domains/zones/${domain.domain}/dns-records/${req.params.type}/${req.params.name}`,
      { method: 'DELETE', headers: { Authorization: authHeader() } }
    );
    if (response.status === 204 || response.status === 200) return res.status(204).end();
    const data = await response.json();
    res.status(response.status).json({ error: data.message || 'GoDaddy error', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
