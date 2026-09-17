import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { isGoDaddyConfigured, getGoDaddyDomainDetail } = require('@/lib/godaddyClient');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/domains/:id/detail
 * Refreshes a domain's real expiry date and auto-renew state from
 * GoDaddy and stores them locally, so the dashboard can show them
 * without a live API call on every page load. No money involved —
 * this is a read-only GET against GoDaddy's own domain-detail endpoint.
 */
async function GET_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const domain = db.domains.find((d) => d.id === id && d.ownerId === user.id);
  if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
  if (!isGoDaddyConfigured()) {
    return NextResponse.json({ error: 'Server is missing GODADDY_PAT in .env' }, { status: 500 });
  }

  try {
    const detail = await getGoDaddyDomainDetail(domain.domain);
    const updated = await db.domains.update((d) => d.id === domain.id, {
      status: detail.status || domain.status,
      expires: detail.expires || null,
      renewAuto: typeof detail.renewAuto === 'boolean' ? detail.renewAuto : null
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
export const GET = withSanitizedErrors(GET_impl);
