import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireRole } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/admin/orders
 * Every order across every account, most recent first. Unlike the
 * customer-facing GET /api/payments/orders/:id (which deliberately
 * strips baseUsdCents/exchangeRate/markupPercent — a customer should
 * never see what Altegic actually pays a provider, or the margin taken),
 * this DOES include that breakdown. Seeing real margin, order-by-order,
 * is the actual point of a business management view — hiding it here
 * the same way the customer-facing endpoint does would make this
 * endpoint useless for its purpose.
 */
async function GET_impl(request) {
  try {
    requireRole(request, ['admin']);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const userEmailById = {};
  db.users.all().forEach((u) => { userEmailById[u.id] = u.email; });

  const orders = db.orders.all()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((o) => ({ ...o, ownerEmail: userEmailById[o.ownerId] || 'unknown' }));

  return NextResponse.json({ orders });
}
export const GET = withSanitizedErrors(GET_impl);
