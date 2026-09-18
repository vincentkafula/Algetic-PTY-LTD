import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireRole } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/admin/stats
 * Aggregate counts across the whole platform — a business overview, not
 * per-account detail (that's what /api/admin/users and
 * /api/admin/orders are for). Computed fresh from the current data on
 * every call rather than cached/stored anywhere, so it's always
 * accurate as of the moment it's requested.
 */
async function GET_impl(request) {
  try {
    requireRole(request, ['admin']);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const usersByRole = {};
  db.users.all().forEach((u) => {
    const role = u.role || 'purchasing';
    usersByRole[role] = (usersByRole[role] || 0) + 1;
  });

  const ordersByStatus = {};
  let totalRevenueZarCents = 0;
  db.orders.all().forEach((o) => {
    ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
    if (o.status === 'paid' || o.status === 'fulfilled') {
      totalRevenueZarCents += o.customerZarCents || 0;
    }
  });

  return NextResponse.json({
    totalUsers: db.users.all().length,
    usersByRole,
    totalMailboxes: db.mailboxes.all().length,
    totalNumbers: db.numbers.all().length,
    totalDomains: db.domains.all().length,
    totalProjects: db.projects.all().length,
    totalOrders: db.orders.all().length,
    ordersByStatus,
    totalRevenueZarCents,
    totalRevenueFormatted: `R${(totalRevenueZarCents / 100).toFixed(2)}`
  });
}
export const GET = withSanitizedErrors(GET_impl);
