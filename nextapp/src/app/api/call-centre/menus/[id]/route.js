import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');

/**
 * DELETE /api/call-centre/menus/:id
 */
export async function DELETE(request, { params }) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { id } = await params;
  const menu = db.ivrMenus.find((m) => m.id === id && m.ownerId === user.id);
  if (!menu) return NextResponse.json({ error: 'Menu not found' }, { status: 404 });

  const inUse = db.numbers.find((n) => n.ownerId === user.id && n.callCentreMenuId === menu.id);
  if (inUse) {
    return NextResponse.json({ error: `${inUse.phoneNumber} is still assigned to this menu — unassign it first` }, { status: 409 });
  }

  await db.ivrMenus.remove((m) => m.id === menu.id);
  return new NextResponse(null, { status: 204 });
}
