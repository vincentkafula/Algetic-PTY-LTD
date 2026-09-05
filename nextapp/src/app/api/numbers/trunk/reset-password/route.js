import { NextResponse } from 'next/server';

const { requireAuth } = require('@/lib/auth');
const trunking = require('@/lib/services/trunking');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * POST /api/numbers/trunk/reset-password
 * Regenerates the account's SIP credential. Returns the new password
 * once — it cannot be retrieved again after this response, by design.
 */
async function POST_impl(request) {
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
export const POST = withSanitizedErrors(POST_impl);
