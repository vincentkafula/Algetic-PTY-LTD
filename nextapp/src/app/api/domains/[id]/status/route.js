import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { isGoDaddyConfigured, authHeader } = require('@/lib/godaddyClient');

/**
 * GET /api/domains/:id/status
 * Polls GoDaddy for the current status of a pending registration and
 * updates the local record. Registration is async on GoDaddy's side —
 * a 201 from /register doesn't mean the domain is live yet.
 */
export async function GET(request, { params }) {
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
  if (!domain.godaddyPollUrl) {
    return NextResponse.json(domain); // Nothing to poll — return what we have.
  }

  try {
    const response = await fetch(domain.godaddyPollUrl, { headers: { Authorization: authHeader() } });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.message || 'GoDaddy error', data }, { status: response.status });

    const updated = await db.domains.update((d) => d.id === domain.id, { status: data.status || domain.status });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
