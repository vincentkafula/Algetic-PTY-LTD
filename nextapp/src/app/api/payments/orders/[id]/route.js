import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');

/**
 * GET /api/payments/orders/:id
 * For the frontend to poll after returning from PayFast (the ITN webhook
 * usually arrives faster than the customer's browser redirect back, but
 * "usually" isn't "always" — polling a few times covers that gap).
 *
 * Next.js 15 note: dynamic route params are a Promise that must be
 * awaited (a real breaking change from Next.js 14, verified against
 * current docs before writing this) — not just object destructuring
 * like the Express version's req.params.id.
 */
export async function GET(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const order = db.orders.find((o) => o.id === id && o.ownerId === user.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Deliberately not returning baseUsdCents/exchangeRate/markupPercent —
  // internal pricing breakdown, not something to expose even to the
  // paying customer's own account view.
  const { baseUsdCents, exchangeRate, markupPercent, ...customerSafe } = order;
  return NextResponse.json(customerSafe);
}
