const express = require('express');
const router = express.Router();

const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createOrderWithCheckout } = require('../services/orders');

// ---------------------------------------------------------------------------
// Generic order + checkout creation, shared by every paid service (domain
// registration, number provisioning, mailbox creation). The actual
// pricing/order/PayFast logic lives in services/orders.js — this file is
// thin HTTP glue. Domain registration calls that same shared function
// directly (see routes/domains.js) rather than round-tripping through
// this endpoint, since it needs an extra step first (a fresh GoDaddy
// quote, fetched server-side rather than trusted from the client).
//
// The customer never sees baseUsdCents, the exchange rate, or the markup
// percentage individually — only the final ZAR price.
// ---------------------------------------------------------------------------

router.use(requireAuth);

/**
 * POST /api/payments/orders
 * body: { fulfillmentType, fulfillmentData, baseUsdCents, itemName, itemDescription }
 */
router.post('/orders', async (req, res) => {
  const { fulfillmentType, fulfillmentData, baseUsdCents, itemName, itemDescription } = req.body || {};
  if (!fulfillmentType || !itemName || typeof baseUsdCents !== 'number') {
    return res.status(400).json({ error: 'fulfillmentType, itemName, and baseUsdCents are required' });
  }

  try {
    const result = await createOrderWithCheckout({
      ownerId: req.user.id,
      ownerEmail: req.user.email,
      fulfillmentType,
      fulfillmentData,
      baseUsdCents,
      itemName,
      itemDescription
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

/**
 * GET /api/payments/orders/:id
 * For the frontend to poll after returning from PayFast (the ITN webhook
 * usually arrives faster than the customer's browser redirect back, but
 * "usually" isn't "always" — polling a few times covers that gap).
 */
router.get('/orders/:id', (req, res) => {
  const order = db.orders.find((o) => o.id === req.params.id && o.ownerId === req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  // Deliberately not returning baseUsdCents/exchangeRate/markupPercent —
  // internal pricing breakdown, not something to expose even to the
  // paying customer's own account view.
  const { baseUsdCents, exchangeRate, markupPercent, ...customerSafe } = order;
  res.json(customerSafe);
});

/**
 * GET /api/payments/orders
 * List this account's orders.
 */
router.get('/orders', (req, res) => {
  const orders = db.orders.filter((o) => o.ownerId === req.user.id);
  const safe = orders.map(({ baseUsdCents, exchangeRate, markupPercent, ...rest }) => rest);
  res.json({ orders: safe });
});

module.exports = router;

