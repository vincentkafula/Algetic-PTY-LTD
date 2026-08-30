const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const router = express.Router();

const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { GODADDY_BASE_URL, isGoDaddyConfigured, authHeader } = require('../godaddyClient');

// ---------------------------------------------------------------------------
// Domain registration via GoDaddy's v3 "quote-execute" API. Scoped per
// CommHub account, same as mailboxes/numbers.
//
// IMPORTANT: registering a domain charges GoDaddy's payment profile on
// this account and is NOT reversible (GoDaddy's own words, in their
// developer docs). This is why the flow is deliberately three separate
// steps rather than one — search, quote, register — with the frontend
// required to show the price and any required agreements and capture an
// explicit confirmation before the register step is ever called. There is
// no "just register it" shortcut route, on purpose.
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
router.post('/quote', async (req, res) => {
  if (!assertConfigured(res)) return;
  const { domain, period } = req.body || {};
  if (!domain) return res.status(400).json({ error: 'domain is required' });

  try {
    const response = await fetch(`${GODADDY_BASE_URL}/domains/registration-quotes`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, period: period || 1 })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.message || 'GoDaddy error', data });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/domains/register
 * body: { quoteToken, domain, period, agreedAgreementTypes }
 * Executes the registration — this is the step that actually charges
 * money and cannot be undone. agreedAgreementTypes must be a non-empty
 * array; this route refuses to proceed without it, as a server-side
 * backstop against a frontend bug skipping the consent step.
 */
router.post('/register', async (req, res) => {
  if (!assertConfigured(res)) return;
  const { quoteToken, domain, period, agreedAgreementTypes } = req.body || {};
  if (!quoteToken || !domain) return res.status(400).json({ error: 'quoteToken and domain are required' });
  if (!Array.isArray(agreedAgreementTypes) || agreedAgreementTypes.length === 0) {
    return res.status(400).json({ error: 'agreedAgreementTypes must list every agreement the customer confirmed — registration was not attempted' });
  }

  const idempotencyKey = crypto.randomUUID();

  try {
    const response = await fetch(`${GODADDY_BASE_URL}/domains/registrations`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        quoteToken,
        domain,
        period: period || 1,
        consent: {
          agreedAt: new Date().toISOString(),
          agreementTypes: agreedAgreementTypes
        }
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.message || 'GoDaddy error', data });

    const record = {
      id: crypto.randomUUID(),
      ownerId: req.user.id,
      domain,
      status: data.status || 'PENDING',
      godaddyRegistrationId: data.registrationId || data.id || null,
      godaddyPollUrl: data.operationUrl || data.pollUrl || null,
      period: period || 1,
      registeredAt: new Date().toISOString()
    };
    await db.domains.insert(record);
    res.status(202).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/domains
 * List domains this account has registered through CommHub.
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

module.exports = router;
