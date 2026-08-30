const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');

// ---------------------------------------------------------------------------
// Proxies the dashboard's "Private SIP Network" panel to the management API
// running on the separate SIP-network VPS (see /sip-network in this repo).
//
// SCOPING NOTE, same as sip-network/api/server.js: this is NOT per-Altegic-
// account like mailboxes/numbers are. Every logged-in Altegic user who can
// reach this dashboard can manage the one shared subscriber list — correct
// for "my own team's private calling system," wrong for reselling isolated
// networks to separate customers. If you need that, both this file and
// the VPS-side API would need an account/tenant concept added.
// ---------------------------------------------------------------------------

const SIP_NETWORK_API_URL = process.env.SIP_NETWORK_API_URL;
const SIP_NETWORK_API_KEY = process.env.SIP_NETWORK_API_KEY;

function isSipNetworkConfigured() {
  return Boolean(SIP_NETWORK_API_URL && SIP_NETWORK_API_KEY);
}

function upstreamHeaders() {
  return {
    Authorization: `Bearer ${SIP_NETWORK_API_KEY}`,
    'Content-Type': 'application/json'
  };
}

router.use(requireAuth);

/**
 * GET /api/sip-network/users
 */
router.get('/users', async (req, res) => {
  if (!isSipNetworkConfigured()) {
    return res.status(500).json({ error: 'Server is missing SIP_NETWORK_API_URL / SIP_NETWORK_API_KEY in .env' });
  }
  try {
    const response = await fetch(`${SIP_NETWORK_API_URL}/subscribers`, { headers: upstreamHeaders() });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: `Could not reach the SIP network API: ${err.message}` });
  }
});

/**
 * POST /api/sip-network/users
 * body: { username, password }
 */
router.post('/users', async (req, res) => {
  if (!isSipNetworkConfigured()) {
    return res.status(500).json({ error: 'Server is missing SIP_NETWORK_API_URL / SIP_NETWORK_API_KEY in .env' });
  }
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  try {
    const response = await fetch(`${SIP_NETWORK_API_URL}/subscribers`, {
      method: 'POST',
      headers: upstreamHeaders(),
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: `Could not reach the SIP network API: ${err.message}` });
  }
});

/**
 * DELETE /api/sip-network/users/:username
 */
router.delete('/users/:username', async (req, res) => {
  if (!isSipNetworkConfigured()) {
    return res.status(500).json({ error: 'Server is missing SIP_NETWORK_API_URL / SIP_NETWORK_API_KEY in .env' });
  }
  try {
    const response = await fetch(`${SIP_NETWORK_API_URL}/subscribers/${encodeURIComponent(req.params.username)}`, {
      method: 'DELETE',
      headers: upstreamHeaders()
    });
    if (response.status === 204) return res.status(204).end();
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: `Could not reach the SIP network API: ${err.message}` });
  }
});

module.exports = router;
