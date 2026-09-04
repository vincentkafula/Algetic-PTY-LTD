import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const payfast = require('@/lib/services/payfast');

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
    case 'number':
    case 'mailbox':
      console.log(`PayFast ITN: order ${order.id} paid, fulfillmentType "${order.fulfillmentType}" not wired to real provisioning yet in the Next.js version`);
      break;
    default:
      console.error('PayFast ITN: unknown fulfillmentType, cannot fulfill', { orderId, fulfillmentType: order.fulfillmentType });
  }
}
