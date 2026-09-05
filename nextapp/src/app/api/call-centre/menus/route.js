import { NextResponse } from 'next/server';

const crypto = require('crypto');
const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/call-centre/menus
 */
async function GET_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  const menus = db.ivrMenus.filter((m) => m.ownerId === user.id);
  return NextResponse.json({ menus });
}

/**
 * POST /api/call-centre/menus
 * body: { name, greeting, options: [{ digit, action, target }] }
 * action is one of: "dial" (target = phone number), "queue" (target =
 * queue id), "menu" (target = another menu id, for submenus), "hangup"
 * (target = optional closing message).
 */
async function POST_impl(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, greeting, options } = body || {};
  if (!name || !greeting) return NextResponse.json({ error: 'name and greeting are required' }, { status: 400 });
  if (!Array.isArray(options) || options.length === 0) {
    return NextResponse.json({ error: 'At least one option is required' }, { status: 400 });
  }
  for (const opt of options) {
    if (!/^[0-9*#]$/.test(opt.digit)) {
      return NextResponse.json({ error: `"${opt.digit}" is not a valid single touch-tone digit (0-9, *, #)` }, { status: 400 });
    }
    if (!['dial', 'queue', 'menu', 'hangup'].includes(opt.action)) {
      return NextResponse.json({ error: `"${opt.action}" is not a valid action` }, { status: 400 });
    }
  }

  const record = {
    id: crypto.randomUUID(),
    ownerId: user.id,
    name,
    greeting,
    options,
    createdAt: new Date().toISOString()
  };
  await db.ivrMenus.insert(record);
  return NextResponse.json(record, { status: 201 });
}
export const GET = withSanitizedErrors(GET_impl);
export const POST = withSanitizedErrors(POST_impl);
