import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { isGoDaddyConfigured, setDomainAutoRenew } = require('@/lib/godaddyClient');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * POST /api/domains/:id/auto-renew
 * body: { renewAuto: true|false }
 * Toggles GoDaddy's own auto-renew flag — free, no charge happens here.
 * This does NOT set up any billing on Altegic's side for the eventual
 * renewal charge; see godaddyClient.js's setDomainAutoRenew for why a
 * full paid-renewal flow isn't built yet.
 */
async function POST_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const domain = db.domains.find((d) => d.id === id && d.ownerId === user.id);
  if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { renewAuto } = body || {};
  if (typeof renewAuto !== 'boolean') {
    return NextResponse.json({ error: 'renewAuto must be true or false' }, { status: 400 });
  }
  if (!isGoDaddyConfigured()) {
    return NextResponse.json({ error: 'Server is missing GODADDY_PAT in .env' }, { status: 500 });
  }

  try {
    await setDomainAutoRenew(domain.domain, renewAuto);
    const updated = await db.domains.update((d) => d.id === domain.id, { renewAuto });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
export const POST = withSanitizedErrors(POST_impl);
