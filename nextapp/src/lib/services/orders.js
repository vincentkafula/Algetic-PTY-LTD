const crypto = require('crypto');

const db = require('@/lib/db');
const pricing = require('./pricing');
const payfast = require('./payfast');

// ---------------------------------------------------------------------------
// Ported from server/services/orders.js. Shared by the generic order
// endpoint AND any service (domains, numbers, mailboxes) that needs to
// create a priced order + PayFast checkout directly.
//
// One real cleanup versus the original, not just a copy: the Express
// version imported PUBLIC_BASE_URL from mailgunClient.js — an odd
// cross-service coupling (it lives there only because Mailgun's webhook
// URL needed it first, historically). Reads directly from process.env
// here instead; mailgunClient.js will do the same when it's ported,
// removing the coupling entirely rather than carrying it forward.
// ---------------------------------------------------------------------------

/**
 * Creates a pending order priced in ZAR (converted + marked up from a
 * provider's real USD cost) and returns everything needed to render a
 * PayFast checkout form. Throws on any failure (not configured, bad
 * price) rather than returning a partial/invalid result — callers (Route
 * Handlers) are expected to catch and translate to an HTTP error.
 */
/**
 * Creates a pending order priced in ZAR (converted + marked up from a
 * provider's real USD cost) and returns everything needed to render a
 * PayFast checkout form. Throws on any failure (not configured, bad
 * price) rather than returning a partial/invalid result — callers (Route
 * Handlers) are expected to catch and translate to an HTTP error.
 *
 * isRecurring: when true, creates a PayFast Subscription (monthly,
 * indefinite - cycles: 0, billed until cancelled) instead of a once-off
 * payment. Used for numbers and mailboxes, which cost Altegic money every
 * month they stay active, unlike a one-time domain registration.
 */
async function createOrderWithCheckout({ ownerId, ownerEmail, fulfillmentType, fulfillmentData, baseUsdCents, itemName, itemDescription, isRecurring }) {
  const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;

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
    isRecurring: Boolean(isRecurring),
    subscriptionToken: null,
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
    email: ownerEmail,
    subscription: isRecurring ? { frequency: 3, cycles: 0 } : undefined
  });

  return {
    orderId: order.id,
    amount: checkoutFields.amount,
    payfastUrl: payfast.PROCESS_URL,
    checkoutFields
  };
}

module.exports = { createOrderWithCheckout };
