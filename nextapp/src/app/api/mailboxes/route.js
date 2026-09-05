import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireAuth } = require('@/lib/auth');
const { MAILGUN_DOMAIN, isMailgunConfigured } = require('@/lib/mailgunClient');
const { createOrderWithCheckout } = require('@/lib/services/orders');

/**
 * Mailgun has no natural per-mailbox price to mark up (unlike GoDaddy's
 * domain quotes or Twilio's number pricing) — Mailgun bills by email
 * volume, not "per mailbox." This is a real business decision, not a
 * technical one, so it's deliberately NOT hardcoded here as some
 * invented number. Set MAILBOX_MONTHLY_PRICE_USD_CENTS in .env once a
 * real price is decided; until then, this throws a clear error rather
 * than silently charging customers a made-up amount.
 */
function getMailboxMonthlyPriceUsdCents() {
  const configured = parseInt(process.env.MAILBOX_MONTHLY_PRICE_USD_CENTS || '', 10);
  if (!isNaN(configured) && configured > 0) return configured;
  const err = new Error('Mailbox pricing has not been configured yet (set MAILBOX_MONTHLY_PRICE_USD_CENTS in .env)');
  err.status = 500;
  throw err;
}

/**
 * GET /api/mailboxes
 */
export async function GET(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }
  const mailboxes = db.mailboxes.filter((m) => m.ownerId === user.id);
  return NextResponse.json({ mailboxes });
}

/**
 * POST /api/mailboxes
 * body: { localPart: "sales", forwardTo: "..." }
 * Does NOT create sales@MAILGUN_DOMAIN directly — creates a payment order
 * and returns a PayFast checkout, mirroring domains and numbers. The
 * actual mailbox creation only happens in the ITN webhook once payment
 * clears.
 */
export async function POST(request) {
  let user;
  try {
    user = requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { localPart, forwardTo } = body || {};
  if (!localPart) {
    return NextResponse.json({ error: 'localPart is required, e.g. "sales"' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(localPart)) {
    return NextResponse.json({ error: 'localPart can only contain letters, numbers, dots, dashes and underscores' }, { status: 400 });
  }
  if (!isMailgunConfigured()) {
    return NextResponse.json({ error: 'Server is missing MAILGUN_API_KEY / MAILGUN_DOMAIN in .env' }, { status: 500 });
  }

  const address = `${localPart}@${MAILGUN_DOMAIN}`;
  const dup = db.mailboxes.find((m) => m.ownerId === user.id && m.address === address);
  if (dup) return NextResponse.json({ error: `${address} already exists on your account` }, { status: 409 });

  try {
    const baseUsdCents = getMailboxMonthlyPriceUsdCents();
    const result = await createOrderWithCheckout({
      ownerId: user.id,
      ownerEmail: user.email,
      fulfillmentType: 'mailbox',
      fulfillmentData: { localPart, forwardTo: forwardTo || null },
      baseUsdCents,
      itemName: address,
      itemDescription: `Mailbox: ${address} (monthly)`,
      isRecurring: true
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
