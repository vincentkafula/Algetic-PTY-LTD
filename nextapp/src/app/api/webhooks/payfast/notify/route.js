import { NextResponse } from 'next/server';

const crypto = require('crypto');
const db = require('@/lib/db');
const payfast = require('@/lib/services/payfast');
const { getGoDaddyQuote, registerGoDaddyDomain } = require('@/lib/godaddyClient');
const { provisionNumberForAccount } = require('@/lib/services/trunking');
const { createMailboxForAccount } = require('@/lib/mailgunClient');

// ---------------------------------------------------------------------------
// Ported from server/routes/paymentWebhooks.js. PayFast's Instant
// Transaction Notification (ITN) — not behind requireAuth, same reasoning
// as every other provider webhook: PayFast calls this directly,
// server-to-server. Authenticity comes from verifying PayFast's own
// signature on every request, not from a session.
//
// REAL NEXT.JS BEHAVIORAL DIFFERENCE, thought through rather than assumed:
// the Express version called res.status(200).end() immediately, then kept
// executing the rest of the handler in the background — Express doesn't
// terminate a handler's execution just because a response was sent. A
// Next.js Route Handler is different: `return` actually exits the
// function, so "respond now, keep working after" isn't directly possible
// the same way. The fix used here — call the processing function WITHOUT
// awaiting it, then return the 200 response immediately — reproduces the
// same fire-and-forget behavior, but it only works correctly because this
// app deploys via `next start` on Railway: a normal persistent Node.js
// process, where the event loop keeps running a detached async call to
// completion regardless of what response was already sent, same as
// Express. This would NOT be safe on true serverless (Vercel functions,
// AWS Lambda), where the execution environment can be frozen or killed
// right after a response is sent, silently dropping the background work —
// not a concern for the actual deployment target here, but worth knowing
// if that ever changes.
//
// FULFILLMENT DISPATCH: marking an order "paid" and actually provisioning
// the real thing are deliberately separate steps. Per-fulfillmentType
// provisioning is NOT wired in yet in this Next.js version — domains,
// numbers, and mailboxes each get ported in their own later phase, same
// incremental discipline as the rest of this migration. This handler
// correctly verifies payment and updates order status, then stops at
// "paid, awaiting fulfillment" for now.
// ---------------------------------------------------------------------------

export async function POST(request) {
  const formData = await request.formData().catch(() => null);
  const posted = formData ? Object.fromEntries(formData.entries()) : {};

  const remoteIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '';

  // Fire-and-forget — see file header for why this is correct specifically
  // because of this app's deployment model.
  processItn(posted, remoteIp).catch((err) => {
    console.error('PayFast ITN: unexpected processing error', { error: err.message });
  });

  // PayFast expects a 200 with no body regardless of outcome — it retries
  // on non-200 responses, which would otherwise cause duplicate
  // processing of the same payment. Every branch inside processItn logs
  // failures server-side instead of surfacing them to PayFast.
  return new NextResponse(null, { status: 200 });
}

async function processItn(posted, remoteIp) {
  if (!payfast.verifyItnSignature(posted)) {
    console.error('PayFast ITN: signature verification failed', { m_payment_id: posted.m_payment_id });
    return;
  }

  const ipOk = await payfast.isFromPayfastIp(remoteIp).catch(() => false);
  if (!ipOk) {
    // Logged, not rejected — see services/payfast.js on why source-IP
    // checking is defense-in-depth, not the primary control. The
    // signature check above is what actually gates this.
    console.warn("PayFast ITN: source IP did not match PayFast's published hosts", { remoteIp, m_payment_id: posted.m_payment_id });
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

  // Fulfillment dispatch point — see file header. Wired in as each
  // service (domain/number/mailbox) is ported in a later phase.
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
}

/**
 * Actually registers the domain with GoDaddy, now that payment has
 * cleared. Fetches a completely fresh quote right here rather than
 * reusing anything from checkout time — a GoDaddy quoteToken is
 * time-limited, and an unknown amount of time may have passed while the
 * customer completed payment.
 *
 * The hard case this handles explicitly: the customer has ALREADY PAID
 * by the time this runs. If GoDaddy's registration call fails now, that
 * money has still been taken with nothing delivered. Marked as a
 * distinct 'fulfillment_failed' order status specifically so it's
 * visible and actionable (refund or manual registration) rather than
 * indistinguishable from a normal paid-and-done order.
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
 * HONEST GAP, stated directly: this charges the customer once, covering
 * the number's first month. Twilio bills Altegic for this number every
 * month it stays active — there is NO recurring billing built here to
 * keep charging the customer for month 2 onward.
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
 * cleared. Note the webmail password createMailboxForAccount generates
 * is effectively unused here — there's no synchronous response to a
 * paying customer's browser at this point, since they've already been
 * redirected to PayFast and back. The customer gets it via the
 * dashboard's "Reset webmail password" action once their order shows as
 * fulfilled, same resolution already used for numbers' SIP passwords.
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
