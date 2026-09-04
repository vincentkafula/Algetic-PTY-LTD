import { NextResponse } from 'next/server';

const crypto = require('crypto');
const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');

// ---------------------------------------------------------------------------
// Ported from server/routes/projects.js. Website, software development,
// internet connectivity, and IP phone hardware requests, tracked through
// a simple status pipeline: Requested -> In Progress -> Delivered (or
// Cancelled).
//
// There's no API that produces a website, custom software, an internet
// connection, or a physical phone on demand — unlike domains/numbers/
// mailboxes, real delivery happens outside this platform. This is
// honestly a lightweight request tracker, not a resold service.
//
// SCOPING NOTE, same as the Express version: this app has no staff/admin
// role distinct from a regular account, so any logged-in user can update
// any of their own project's status.
// ---------------------------------------------------------------------------

const VALID_TYPES = ['website', 'software', 'internet', 'ip-phone'];

/**
 * GET /api/projects
 */
export async function GET(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  const projects = db.projects.filter((p) => p.ownerId === user.id);
  return NextResponse.json({ projects });
}

/**
 * POST /api/projects
 * body: { type: "website"|"software"|"internet"|"ip-phone", title, description, budget? }
 * budget is a free-text field, not parsed or validated as a number.
 */
export async function POST(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { type, title, description, budget } = body || {};
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
  }
  if (!title || !description) {
    return NextResponse.json({ error: 'title and description are required' }, { status: 400 });
  }

  const record = {
    id: crypto.randomUUID(),
    ownerId: user.id,
    type,
    title,
    description,
    budget: budget || null,
    status: 'Requested',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await db.projects.insert(record);
  return NextResponse.json(record, { status: 201 });
}
