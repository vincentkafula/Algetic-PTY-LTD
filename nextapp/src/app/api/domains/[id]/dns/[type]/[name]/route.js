import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const { GODADDY_BASE_URL, isGoDaddyConfigured, authHeader } = require('@/lib/godaddyClient');
const { findOwnedDomain } = require('@/lib/domainOwnership');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * PUT /api/domains/:id/dns/:type/:name
 * body: { records: [{ data, ttl }, ...] }
 * Replaces every record of this type+name in one call — the safe way to
 * "update" a record (POST only appends and will reject a duplicate).
 */
async function PUT_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id, type, name } = await params;
  const domain = findOwnedDomain(user.id, id);
  if (!domain) {
    return NextResponse.json({ error: 'Domain not found on your account — only domains registered through Altegic can be managed here' }, { status: 404 });
  }
  if (!isGoDaddyConfigured()) {
    return NextResponse.json({ error: 'Server is missing GODADDY_PAT in .env' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { records } = body || {};
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'records must be a non-empty array of { data, ttl }' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${GODADDY_BASE_URL}/domains/zones/${domain.domain}/dns-records/${type}/${name}`,
      {
        method: 'PUT',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(records)
      }
    );
    if (response.status === 204 || response.status === 200) {
      return NextResponse.json({ type, name, records });
    }
    const data = await response.json();
    return NextResponse.json({ error: data.message || 'GoDaddy error', data }, { status: response.status });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/domains/:id/dns/:type/:name
 * Removes every record of this type+name (GoDaddy has no single-record
 * delete-by-id in the zone endpoint — deletion is by type+name, same
 * granularity as the replace operation above).
 */
async function DELETE_impl(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id, type, name } = await params;
  const domain = findOwnedDomain(user.id, id);
  if (!domain) {
    return NextResponse.json({ error: 'Domain not found on your account — only domains registered through Altegic can be managed here' }, { status: 404 });
  }
  if (!isGoDaddyConfigured()) {
    return NextResponse.json({ error: 'Server is missing GODADDY_PAT in .env' }, { status: 500 });
  }

  try {
    const response = await fetch(
      `${GODADDY_BASE_URL}/domains/zones/${domain.domain}/dns-records/${type}/${name}`,
      { method: 'DELETE', headers: { Authorization: authHeader() } }
    );
    if (response.status === 204 || response.status === 200) return new NextResponse(null, { status: 204 });
    const data = await response.json();
    return NextResponse.json({ error: data.message || 'GoDaddy error', data }, { status: response.status });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export const PUT = withSanitizedErrors(PUT_impl);
export const DELETE = withSanitizedErrors(DELETE_impl);
