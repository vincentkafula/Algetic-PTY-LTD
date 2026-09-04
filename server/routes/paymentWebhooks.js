const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const db = require('../db');
const payfast = require('../services/payfast');
const { getGoDaddyQuote, registerGoDaddyDomain } = require('../godaddyClient');
const { provisionNumberForAccount } = require('../services/trunking');
const { createMailboxForAccount } = require('../mailgunClient');

// ---------------------------------------------------------------------------
// PayFast's Instant Transaction Notification (ITN) — NOT behind
// requireAuth, same reasoning as the Twilio/Mailgun webhooks elsewhere in
// this app: PayFast calls this directly, server-to-server. Authenticity
// comes from verifying PayFast's own signature on every request, not
// from a session.
//
// FULFILLMENT DISPATCH: marking an order "paid" and actually going to
// provision the real thing (call GoDaddy to register the domain, Twilio
// to buy the number, Mailgun to create the mailbox) are deliberately
// separate steps. Per-fulfillmentType provisioning is NOT wired in yet —
// this handler correctly verifies the payment and updates order status,
// but stops at "paid, awaiting fulfillment" rather than guessing at
// provisioning logic for services this wasn't built against yet. Wiring
// each fulfillmentType's real provisioning call is the next phase.
// ---------------------------------------------------------------------------

router.post('/notify', async (req, res) => {
  // PayFast expects a 200 with no body regardless of outcome — it retries
  // on non-200 responses, which would otherwise cause duplicate
  // processing of the same payment. Every branch below still responds
  // 200; failures are logged server-side instead of surfaced to PayFast.
  res.status(200).end();

  const posted = req.body || {};

  if (!payfast.verifyItnSignature(posted)) {
    console.error('PayFast ITN: signature verification failed', { m_payment_id: posted.m_payment_id });
    return;
  }

  const remoteIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const ipOk = await payfast.isFromPayfastIp(remoteIp).catch(() => false);
  if (!ipOk) {
    // Logged, not rejected — see services/payfast.js on why source-IP
    // checking is treated as defense-in-depth rather than the primary
    // control. The signature check above is what actually gates this.
    console.warn('PayFast ITN: source IP did not match PayFast\'s published hosts', { remoteIp, m_payment_id: posted.m_payment_id });
  }

  const orderId = posted.m_payment_id;
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) {
    console.error('PayFast ITN: no matching order', { orderId });
    return;
  }

  if (order.status !== 'pending') {
    // Already processed (PayFast can and does resend ITNs) — do nothing,
    // rather than risk double-fulfillment from a retried notification.
    return;
  }

  if (posted.payment_status !== 'COMPLETE') {
    await db.orders.update((o) => o.id === order.id, {
      status: 'failed',
      updatedAt: new Date().toISOString()
    });
    return;
  }

  // Sanity-check the amount PayFast says was paid against what this
  // order was actually created for — a mismatch here means something is
  // wrong (tampering, a bug, a stale checkout form) and should NOT be
  // treated as a successful payment even though the signature validated.
  const paidCents = Math.round(parseFloat(posted.amount_gross) * 100);
  if (paidCents !== order.customerZarCents) {
    console.error('PayFast ITN: amount mismatch, refusing to fulfill', {
      orderId, expected: order.customerZarCents, paid: paidCents
    });
    await db.orders.update((o) => o.id === order.id, {
      status: 'amount_mismatch',
      payfastPaymentId: posted.pf_payment_id || null,
      updatedAt: new Date().toISOString()
    });
    return;
  }

  await db.orders.update((o) => o.id === order.id, {
    status: 'paid',
    payfastPaymentId: posted.pf_payment_id || null,
    updatedAt: new Date().toISOString()
  });

  // Fulfillment dispatch point — see file header. Each branch below is
  // where a future phase wires in the real provisioning call.
  switch (order.fulfillmentType) {
    case 'domain':
      await fulfillDomainOrder(order);
      break;
    case 'number':
      await fulfillNumberOrder(order);
      break;
    case 'mailbox':
      await fulfillMailboxOrder(order);
      break;
    default:
      console.error('PayFast ITN: unknown fulfillmentType, cannot fulfill', { orderId, fulfillmentType: order.fulfillmentType });
  }
});

/**
 * Actually registers the domain with GoDaddy, now that payment has
 * cleared. Fetches a completely fresh quote right here rather than
 * reusing anything from checkout time — a GoDaddy quoteToken is
 * time-limited, and an unknown amount of time may have passed while the
 * customer completed payment.
 *
 * The hard case this handles explicitly: the customer has ALREADY PAID
 * by the time this runs. If GoDaddy's registration call fails now (an
 * expired quote can't itself cause this anymore since it's refetched,
 * but the domain could have been registered by someone else in the
 * meantime, GoDaddy's API could be down, etc.), that money has still
 * been taken with nothing delivered. This is marked as a distinct
 * 'fulfillment_failed' order status specifically so it's visible and
 * actionable (refund or manual registration) rather than indistinguishable
 * from a normal paid-and-done order.
 */
async function fulfillDomainOrder(order) {
  const { domain, period, agreedAgreementTypes } = order.fulfillmentData;
  try {
    const quote = await getGoDaddyQuote(domain, period);
    const registration = await registerGoDaddyDomain({
      quoteToken: quote.quoteToken,
      domain,
      period,
      agreedAgreementTypes
    });

    await db.domains.insert({
      id: crypto.randomUUID(),
      ownerId: order.ownerId,
      domain,
      status: registration.status || 'PENDING',
      godaddyRegistrationId: registration.registrationId || registration.id || null,
      godaddyPollUrl: registration.operationUrl || registration.pollUrl || null,
      period,
      registeredAt: new Date().toISOString(),
      orderId: order.id
    });

    await db.orders.update((o) => o.id === order.id, {
      status: 'fulfilled',
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('PayFast ITN: domain registration FAILED after payment — needs manual follow-up', {
      orderId: order.id, domain, error: err.message
    });
    await db.orders.update((o) => o.id === order.id, {
      status: 'fulfillment_failed',
      fulfillmentError: err.message,
      updatedAt: new Date().toISOString()
    });
  }
}

/**
 * Actually purchases the phone number with Twilio, now that payment has
 * cleared — see services/trunking.js's provisionNumberForAccount for the
 * real work (buy + attach to trunk + create the local record).
 *
 * HONEST GAP, stated directly rather than glossed over: this charges the
 * customer once, covering the number's first month. Twilio bills Altegic
 * for this number every month it stays active — there is NO recurring
 * billing built here to keep charging the customer for month 2 onward.
 * PayFast does support recurring/subscription billing via a separate
 * token-based API, which is a real follow-up piece of work, not
 * something this order-based one-time-charge flow already covers.
 */
async function fulfillNumberOrder(order) {
  const { phoneNumber, customerLabel } = order.fulfillmentData;
  try {
    await provisionNumberForAccount(order.ownerId, phoneNumber, customerLabel);
    await db.orders.update((o) => o.id === order.id, {
      status: 'fulfilled',
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('PayFast ITN: number provisioning FAILED after payment — needs manual follow-up', {
      orderId: order.id, phoneNumber, error: err.message
    });
    await db.orders.update((o) => o.id === order.id, {
      status: 'fulfillment_failed',
      fulfillmentError: err.message,
      updatedAt: new Date().toISOString()
    });
  }
}

/**
 * Actually creates the mailbox with Mailgun, now that payment has
 * cleared — see mailgunClient.js's createMailboxForAccount for the real
 * work. Note the webmail password it generates is effectively unused
 * here (there's no synchronous HTTP response to a paying customer's
 * browser at this point, since they've already been redirected away to
 * PayFast and back) — the customer gets it via the dashboard's "Reset
 * webmail password" action once their order shows as fulfilled, same as
 * how a number's SIP password works after the same kind of async
 * fulfillment (see fulfillNumberOrder above).
 */
async function fulfillMailboxOrder(order) {
  const { localPart, forwardTo } = order.fulfillmentData;
  try {
    await createMailboxForAccount(order.ownerId, localPart, forwardTo);
    await db.orders.update((o) => o.id === order.id, {
      status: 'fulfilled',
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('PayFast ITN: mailbox creation FAILED after payment — needs manual follow-up', {
      orderId: order.id, localPart, error: err.message
    });
    await db.orders.update((o) => o.id === order.id, {
      status: 'fulfillment_failed',
      fulfillmentError: err.message,
      updatedAt: new Date().toISOString()
    });
  }
}

module.exports = router;
