import { NextResponse } from 'next/server';

const eppClient = require('@/lib/eppClient');
const { requireRole } = require('@/lib/auth');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/admin/epp/test-connection
 * Admin-only (this is internal infrastructure, not a customer-facing
 * feature). Attempts a real EPP connect + greeting + login + logout
 * against whatever registry is configured via EPP_* env vars — useful
 * once a real registry relationship exists to confirm the connection
 * details actually work, without needing to run a domain command for
 * real. Returns a clear "not configured" response rather than a
 * confusing error while EPP_HOST etc. remain unset, which is the
 * expected state until Altegic is actually accredited and connected
 * to a specific registry (see eppClient.js's own header).
 */
async function GET_impl(request) {
  try {
    requireRole(request, ['admin']);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  if (!eppClient.isEppConfigured()) {
    return NextResponse.json({
      configured: false,
      message: 'No registry connection is configured yet. This is expected until Altegic is ICANN-accredited and has connected to a specific registry — see eppClient.js for what has to happen first.'
    });
  }

  let socket;
  try {
    socket = await eppClient.connect();
    const greeting = await eppClient.readGreeting(socket);
    const loginResponse = await eppClient.login(socket);
    await eppClient.logout(socket);
    socket.end();
    return NextResponse.json({ configured: true, connected: true, greeting, loginResponse });
  } catch (err) {
    if (socket) socket.destroy();
    return NextResponse.json({ configured: true, connected: false, error: err.message }, { status: 502 });
  }
}
export const GET = withSanitizedErrors(GET_impl);
