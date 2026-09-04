const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { PUBLIC_BASE_URL } = require('../mailgunClient');
const pricing = require('../services/pricing');
const payfast = require('../services/payfast');

// ---------------------------------------------------------------------------
// Generic order + checkout creation, shared by every paid service (domain
// registration, number provisioning, mailbox creation). Each service is
// responsible for calling POST /orders with its own real USD cost and a
// `fulfillmentType` + `fulfillmentData` describing what to actually
// provision once payment clears — the ITN webhook handler (routes/
// paymentWebhooks.js) reads that back out to know what to do.
//
// The customer never sees baseUsdCents, the exchange rate, or the markup
// percentage individually — only the final ZAR price. That breakdown is
// stored on the order for this app's own records/support use, not shown
// to the customer through the API responses below by default.
// ---------------------------------------------------------------------------

router.use(requireAuth);

/**
 * POST /api/payments/orders
 * body: { fulfillmentType, fulfillmentData, baseUsdCents, itemName, itemDescription }
 * Creates a pending order priced in ZAR (converted + marked up from the
 * provider's real USD cost) and returns everything needed to render a
 * PayFast checkout form.
 */
router.post('/orders', async (req, res) => {
  const { fulfillmentType, fulfillmentData, baseUsdCents, itemName, itemDescription } = req.body || {};
  if (!fulfillmentType || !itemName || typeof baseUsdCents !== 'number') {
    return res.status(400).json({ error: 'fulfillmentType, itemName, and baseUsdCents are required' });
  }
  if (!payfast.isConfigured()) {
    return res.status(500).json({ error: 'Payments are not configured on this server yet' });
  }
  if (!PUBLIC_BASE_URL) {
    return res.status(500).json({ error: 'Server is missing PUBLIC_BASE_URL — required for PayFast to reach this server' });
  }

  let price;
  try {
    price = await pricing.priceForCustomer(baseUsdCents);
  } catch (err) {
    return res.status(502).json({ error: `Could not price this order: ${err.message}` });
  }

  const order = {
    id: crypto.randomUUID(),
    ownerId: req.user.id,
    status: 'pending', // pending -> paid -> fulfilled, or failed/fulfillment_failed
    fulfillmentType, // 'domain' | 'number' | 'mailbox'
    fulfillmentData: fulfillmentData || {},
    itemName,
    itemDescription: itemDescription || '',
    baseUsdCents: price.baseUsdCents,
    exchangeRate: price.exchangeRate,
    markupPercent: price.markupPercent,
    customerZarCents: price.customerZarCents,
    payfastPaymentId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await db.orders.insert(order);

  const checkoutFields = payfast.buildCheckoutFields({
    orderId: order.id,
    amountZarCents: order.customerZarCents,
    itemName: order.itemName,
    itemDescription: order.itemDescription,
    returnUrl: `${PUBLIC_BASE_URL}/checkout/return?order=${order.id}`,
    cancelUrl: `${PUBLIC_BASE_URL}/checkout/cancel?order=${order.id}`,
    notifyUrl: `${PUBLIC_BASE_URL}/api/webhooks/payfast/notify`,
    email: req.user.email
  });

  res.status(201).json({
    orderId: order.id,
    amount: checkoutFields.amount,
    payfastUrl: payfast.PROCESS_URL,
    checkoutFields
  });
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
