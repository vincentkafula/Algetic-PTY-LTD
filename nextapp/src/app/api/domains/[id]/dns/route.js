import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { GODADDY_BASE_URL, isGoDaddyConfigured, authHeader } = require('@/lib/godaddyClient');
const { findOwnedDomain } = require('@/lib/domainOwnership');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/domains/:id/dns?type=A&name=www
 * Lists DNS records for this domain. type/name filter is optional.
 */
async function GET_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const domain = findOwnedDomain(user.id, id);
  if (!domain) {
    return NextResponse.json({ error: 'Domain not found on your account — only domains registered through Altegic can be managed here' }, { status: 404 });
  }
  if (!isGoDaddyConfigured()) {
    return NextResponse.json({ error: 'Server is missing GODADDY_PAT in .env' }, { status: 500 });
  }

  try {
    const url = new URL(`${GODADDY_BASE_URL}/domains/zones/${domain.domain}/dns-records`);
    const type = request.nextUrl.searchParams.get('type');
    const name = request.nextUrl.searchParams.get('name');
    if (type) url.searchParams.set('type', type);
    if (name) url.searchParams.set('name', name);
    const response = await fetch(url, { headers: { Authorization: authHeader() } });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.message || 'GoDaddy error', data }, { status: response.status });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/domains/:id/dns
 * body: { type, name, data, ttl }
 * Appends a record. GoDaddy rejects this if an identical record already
 * exists, or if it would conflict with an existing one — that rejection
 * is passed through as-is rather than papered over.
 */
async function POST_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const domain = findOwnedDomain(user.id, id);
  if (!domain) {
    return NextResponse.json({ error: 'Domain not found on your account — only domains registered through Altegic can be managed here' }, { status: 404 });
  }
  if (!isGoDaddyConfigured()) {
    return NextResponse.json({ error: 'Server is missing GODADDY_PAT in .env' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { type, name, data: recordData, ttl } = body || {};
  if (!type || !name || !recordData) {
    return NextResponse.json({ error: 'type, name, and data are all required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${GODADDY_BASE_URL}/domains/zones/${domain.domain}/dns-records`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{ type, name, data: recordData, ttl: ttl || 600 }])
    });
    if (response.status === 204 || response.status === 200) {
      return NextResponse.json({ type, name, data: recordData, ttl: ttl || 600 }, { status: 201 });
    }
    const data = await response.json();
    return NextResponse.json({ error: data.message || 'GoDaddy error', data }, { status: response.status });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export const GET = withSanitizedErrors(GET_impl);
export const POST = withSanitizedErrors(POST_impl);
