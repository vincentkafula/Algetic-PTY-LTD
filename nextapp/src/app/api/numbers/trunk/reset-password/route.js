import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const trunking = require('@/lib/services/trunking');

/**
 * POST /api/numbers/trunk/reset-password
 * Regenerates the account's SIP credential. Returns the new password
 * once — it cannot be retrieved again after this response, by design.
 */
export async function POST(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  try {
    const { record, generatedPassword } = await trunking.resetCredential(user.id);
    return NextResponse.json({ trunk: trunking.publicTrunk(record), password: generatedPassword });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
