import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { createOrderWithCheckout } = require('@/lib/services/orders');

// ---------------------------------------------------------------------------
// Ported from server/routes/payments.js. Generic order + checkout
// creation, shared by every paid service. The actual pricing/order/
// PayFast logic lives in src/lib/services/orders.js — this file is thin
// HTTP glue, same as the Express version was. Domain registration calls
// that same shared function directly (not through this endpoint) since
// it needs an extra step first — a fresh GoDaddy quote, fetched
// server-side rather than trusted from the client.
//
// The customer never sees baseUsdCents, the exchange rate, or the markup
// percentage individually — only the final ZAR price.
// ---------------------------------------------------------------------------

/**
 * POST /api/payments/orders
 * body: { fulfillmentType, fulfillmentData, baseUsdCents, itemName, itemDescription }
 */
export async function POST(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { fulfillmentType, fulfillmentData, baseUsdCents, itemName, itemDescription } = body || {};
  if (!fulfillmentType || !itemName || typeof baseUsdCents !== 'number') {
    return NextResponse.json({ error: 'fulfillmentType, itemName, and baseUsdCents are required' }, { status: 400 });
  }

  try {
    const result = await createOrderWithCheckout({
      ownerId: user.id,
      ownerEmail: user.email,
      fulfillmentType,
      fulfillmentData,
      baseUsdCents,
      itemName,
      itemDescription
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 502 });
  }
}

/**
 * GET /api/payments/orders
 * List this account's orders.
 */
export async function GET(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const orders = db.orders.filter((o) => o.ownerId === user.id);
  const safe = orders.map(({ baseUsdCents, exchangeRate, markupPercent, ...rest }) => rest);
  return NextResponse.json({ orders: safe });
}
