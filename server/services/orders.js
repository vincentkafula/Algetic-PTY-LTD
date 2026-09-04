const crypto = require('crypto');

const db = require('../db');
const { PUBLIC_BASE_URL } = require('../mailgunClient');
const pricing = require('./pricing');
const payfast = require('./payfast');

// ---------------------------------------------------------------------------
// Shared by routes/payments.js's generic order endpoint AND any service
// (starting with domains) that needs to create a priced order + PayFast
// checkout directly, without a round-trip through that generic endpoint.
// ---------------------------------------------------------------------------

/**
 * Creates a pending order priced in ZAR (converted + marked up from a
 * provider's real USD cost) and returns everything needed to render a
 * PayFast checkout form. Throws on any failure (not configured, bad
 * price) rather than returning a partial/invalid result — callers
 * (Express routes) are expected to catch and translate to an HTTP error.
 */
async function createOrderWithCheckout({ ownerId, ownerEmail, fulfillmentType, fulfillmentData, baseUsdCents, itemName, itemDescription }) {
  if (!payfast.isConfigured()) {
    const err = new Error('Payments are not configured on this server yet');
    err.status = 500;
    throw err;
  }
  if (!PUBLIC_BASE_URL) {
    const err = new Error('Server is missing PUBLIC_BASE_URL — required for PayFast to reach this server');
    err.status = 500;
    throw err;
  }

  const price = await pricing.priceForCustomer(baseUsdCents);

  const order = {
    id: crypto.randomUUID(),
    ownerId,
    status: 'pending',
    fulfillmentType,
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
    email: ownerEmail
  });

  return {
    orderId: order.id,
    amount: checkoutFields.amount,
    payfastUrl: payfast.PROCESS_URL,
    checkoutFields
  };
}

module.exports = { createOrderWithCheckout };
