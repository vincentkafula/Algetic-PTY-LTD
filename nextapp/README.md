# Altegic — Next.js version

This is a full rewrite of Altegic's Express/Vite application (`server/`
elsewhere in this repo) into Next.js 15 (App Router), built on top of the
purchased Cybal cybersecurity template for the marketing pages. Every
backend route and every frontend page from the original app has a tested
equivalent here. **This app is currently a separate preview deployment,
not yet the live production site** — see "Cutover" at the bottom.

If you haven't read `README.md` at the repo root (the Express version's
documentation), several sections there still apply conceptually here
(what MVNO actually is, why China isn't offered, the South Africa/Zambia
number caveats, etc.) — this document focuses on what's specific to the
Next.js rewrite: what changed, why, and what was verified.

## Run it locally

```bash
cd nextapp
npm install --legacy-peer-deps
cp .env.example .env.local
```

The `--legacy-peer-deps` flag is required — the template ships with
`react-slick`, whose published peer-dependency range doesn't yet include
React 19 (the underlying library works fine; it's the version metadata
that's behind). Set at minimum:

```bash
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
```

Then:

```bash
npm run build   # required at least once - see below
npm start
```

Open **http://localhost:3000**. Unlike the Express/Vite version, Next.js
loads `.env` / `.env.local` automatically — no `dotenv` package, and no
separate frontend build step to remember: `npm run build` compiles
everything (API routes and pages) in one pass.

**A real, specific security note if you're setting this up fresh:** the
template as purchased pinned Next.js 15.5.6, which has a CVSS 10.0
remote-code-execution vulnerability (CVE-2025-66478), patched in 15.5.7.
`package.json` here is already fixed to `^15.5.7` — if you ever
regenerate `package.json` from the original template zip, re-apply this
before installing anything else.

## What changed vs. the Express/Vite version, and why

**Nothing about the actual business logic changed.** Same pricing rules,
same payment flow, same provider integrations, same honesty about what's
real vs. simulated. What changed is entirely about the framework:

- **Express routes → Next.js Route Handlers.** File-based routing
  (`src/app/api/.../route.js`) instead of one big `routes/*.js` file per
  feature. Where an Express file had several endpoints sharing local
  helper functions, those helpers got extracted into `src/lib/` so the
  now-separate route files can still share them (`domainOwnership.js`,
  `webmailFolders.js`, `callCentreVoice.js`, etc.) — noted in each file's
  header comment.
- **`req`/`res` → `NextRequest`/`NextResponse`.** Query params via
  `request.nextUrl.searchParams`, not `req.query`. Dynamic route segments
  (`[id]`) are an **async** `params` object in Next.js 15 — `const { id }
  = await params`, a real breaking change from Next.js 14.
- **Express middleware chains → callable helpers.** `requireAuth(request)`
  and `requireMailboxAuth(request)` are called explicitly at the top of
  each protected handler, not attached as middleware — Route Handlers
  don't chain the same way Express routes do.
- **Webhooks needed real thought, not just translation.** Twilio and
  PayFast signature verification both need the exact URL that was
  signed, reconstructed from `request.headers.get('host')` +
  `request.nextUrl.pathname` + `request.nextUrl.search` instead of
  Express's `req.get('host')` + `req.originalUrl`. Form-encoded webhook
  bodies (Twilio, PayFast) are read via `request.formData()` +
  `Object.fromEntries()`.
- **The PayFast ITN webhook's fire-and-forget pattern required actual
  reasoning, not assumption.** Express's `res.status(200).end()` doesn't
  stop the rest of the handler from running — Route Handlers are
  different: `return` genuinely exits the function. The fix (call the
  processing function without awaiting it, then return 200 immediately)
  reproduces the same behavior, but **only works because this app
  deploys via `next start` on Railway** — a persistent Node process,
  same as Express. This would NOT be safe on serverless (Vercel
  functions, AWS Lambda), where the execution environment can be frozen
  right after a response is sent.
- **`useSearchParams()` requires a Suspense boundary**, or the
  production build fails outright (checkout return page). A pure
  client-side Vite SPA never had this constraint — there was no
  build-time prerendering step to trip over it.
- **Dashboard panels are plain `.jsx`, not `.tsx`.** `tsconfig.json` has
  `strict: true` and `allowJs: true`. Building the panels as `.tsx` hit
  real strict-mode friction (implicit-`any` state, missing prop types)
  on the first two pages built (login, dashboard shell) — every panel
  after that was built as `.jsx` specifically to skip that overhead,
  confirmed via clean builds. Top-level pages that need real type safety
  (or that Next.js requires as a Server Component wrapper) stay `.tsx`.
- **`localStorage` needs `typeof window` guards.** Both client-side
  session modules (`clientAuth.js` for the Altegic account session,
  `webmailApi.js` for the separate mailbox session) guard every
  `localStorage` access — it doesn't exist during Next.js's
  server-rendering pass, a concern the pure client-side Vite SPA never
  had.
- **No `node-fetch` anywhere.** Node 22 (this app's target) has fetch
  built in globally. One fewer dependency across every service file.

## Architecture

```
src/
  app/
    api/                  Route Handlers - one folder per endpoint
      auth/                signup, login, me
      payments/            generic order creation/status
      webhooks/
        payfast/notify/    PayFast ITN - signature verification, order
                           lifecycle, fulfillment dispatch
        twilio/            team-voice, voice, gather, agent-connect TwiML
      domains/             search, suggestions, quote, register, DNS, status
      numbers/             search, provision, trunk management, release
      team-calling/        SIP domain, members, number assignment
      call-centre/         menus, queues, agents, number assignment
      mailboxes/           list/create, send, messages, webmail-password
      webmail/             login, me, messages, send (SEPARATE auth system)
      projects/            website/software/internet/ip-phone request tracker
      mvno/                7 endpoints, all simulated demo data
      health/              GET /api/health
    dashboard/page.tsx      the dashboard shell (sidebar, health banner,
                           panel switching via client-side state)
    login/page.tsx          Altegic account login/signup
    webmail-login/page.tsx  mailbox-level login (separate from the above)
    webmail/page.jsx        the actual inbox UI
    checkout/return|cancel/ where PayFast redirects after payment
    (root)/page.tsx         Home 01 - the real Altegic marketing page
  components/
    dashboard/*.jsx         the 7 dashboard panels
    checkout/*.jsx          the return page's client-side polling logic
    homes/, layouts/, ...   the Cybal template's own components, edited
                           in place with real Altegic content
  lib/
    db.js                   JSON-file store - see below
    auth.js, mailboxAuth.js the two independent auth systems
    twilioClient.js, godaddyClient.js, mailgunClient.js
    services/               payfast.js, payfastRecurring.js, pricing.js,
                           exchangeRate.js, orders.js, trunking.js,
                           sipDomain.js, twilioPricing.js, mvnoDemo.js
    clientAuth.js, webmailApi.js, useAuthedFetch.js, useWebmailAuthedFetch.js
                            client-side session management (both systems)
  styles/
    dashboard.css           ported from the Vite app's global.css -
                           sidebar/table/status-banner styles the
                           marketing template has no equivalent for
    webmailLogin.css, webmailInbox.css
```

## Data storage

Same JSON-file store as the Express version (`src/lib/db.js`), same
`process.cwd()`-relative path — actually a real adaptation, not a copy:
the original used a `__dirname`-relative path, which Next.js's
build/bundling (especially `output: 'standalone'`, which traces and
relocates only the files a route needs) can silently break by changing
where the module physically ends up at runtime. `process.cwd()` stays
stable regardless of bundling mode. Same production caveat as the
Express version applies: swap this for a real database before real
traffic depends on it.

## The two independent authentication systems

Exactly as in the Express version, and just as important to keep
straight here:

- **Account auth** (`src/lib/auth.js`) — an Altegic reseller account:
  signup/login, manages mailboxes/numbers/domains/etc. Tokens carry
  `typ: 'account'`.
- **Mailbox auth** (`src/lib/mailboxAuth.js`) — the actual end customer
  who owns `sales@theirdomain.com`, logging into their own webmail. No
  knowledge of, or access to, the Altegic account that provisioned it.
  Tokens carry `typ: 'mailbox'`.

Both are signed with the same `JWT_SECRET` (no reason to manage two
secrets) but the `typ` claim means one can never be used as the other.
**Verified in both directions against a running server**: an account
token is rejected on every webmail endpoint, and a webmail token is
rejected on every account endpoint.

## Customer billing (PayFast)

Same pricing engine as the Express version — `services/pricing.js`
converts a provider's real USD cost to ZAR (`services/exchangeRate.js`,
via Frankfurter/ECB rates) and applies a markup (`MARKUP_PERCENT`, env
var, default 25%). Same honest limitation: ECB rates update once daily,
not tick-by-tick.

**New in this rewrite, not present in the Express version: real
recurring billing.** Every earlier phase of this migration that touched
payments flagged the same gap honestly — numbers and mailboxes charged
once for the first month and nothing re-billed the customer, even though
Twilio/Mailgun keep costing Altegic money every month the resource stays
active. This is now closed using PayFast's Subscriptions API (monthly,
`cycles: 0` = indefinite, billed until cancelled):

- `services/payfast.js`'s `buildCheckoutFields` accepts an optional
  `subscription: { frequency, cycles }` and throws a clear error if a
  subscription checkout is attempted without `PAYFAST_PASSPHRASE` set —
  **required** for subscriptions, unlike basic once-off checkout where
  it's optional.
- `services/payfastRecurring.js` is the **separate** Recurring Billing
  management API client (fetch/pause/unpause/cancel/update an existing
  subscription). This is not a variant of the checkout signature — it's
  a genuinely different algorithm (alphabetical key order, not given
  order), verified against PayFast's own docs and an independently-found
  reference implementation before writing a line of code, and kept in
  its own file specifically so a future edit to one signature function
  can never silently break the other.
- The PayFast ITN webhook captures the `token` field (present only for
  subscription payments) and stores it on the actual number/mailbox
  record, not just the order — needed so the resource can be looked up
  by ID later.
- `DELETE /api/numbers/:id` and `DELETE /api/mailboxes/:id` now cancel
  the underlying subscription before removing the local record. Without
  this, deleting a resource would stop the service while the customer
  kept being charged monthly for something they no longer have. Treated
  as non-fatal if the cancellation call itself fails (logged clearly for
  manual follow-up) — a failed cancellation attempt never blocks the
  customer from actually deleting their resource.
- **Domains stay once-off, deliberately** — registering a domain is
  genuinely a one-time event in this system. (Real-world domain
  registrations need annual renewal; this app does not yet model
  renewal at all, for either billing or expiry tracking — a gap that
  exists in both the Express and Next.js versions, not something new to
  this rewrite.)

**Not yet verified: an actual PayFast sandbox transaction, start to
finish, for either the once-off or the subscription flow.** No live
PayFast credentials were available while building this — everything
has been tested as thoroughly as possible without them (signature
algorithms hand-verified against independent references, real API
calls confirmed to reach PayFast's actual servers and fail cleanly with
fake credentials, the full ITN pipeline tested with real signed test
payloads). A real transaction is the one thing that would confirm this
all works in practice, not just in principle.

## Keeping providers invisible to customers

Same discipline as the Express version, re-applied here as each feature
was ported: no "GoDaddy", "Twilio", or "Mailgun" in customer-facing
copy, and — the less obvious leak — no provider names in error messages
either, since most error text isn't copy this app wrote, it's forwarded
from a provider's own SDK/API response.

`src/lib/sanitizeError.js` ports the Express version's protection,
including both real bugs found while testing that version (URL-
containing messages getting mangled into garbled text instead of
replaced outright; the `data`-field strip briefly breaking the MVNO
dashboard by not being scoped to error responses only) — carried
forward as fixes, not rediscovered from scratch. The mechanism had to
change, though: Express's version worked as a single global middleware
that monkey-patched `res.json()`, since Express middleware can intercept
a handler's output before it's sent. Next.js's `middleware.ts` has no
equivalent capability — it runs before a Route Handler executes and can
produce an early response, but cannot inspect or rewrite the handler's
own response body afterward. The replacement is `withSanitizedErrors()`,
a wrapper applied to every exported Route Handler across all 61 API
route files (mechanically, via a one-time script — each `export async
function GET(...)` became `async function GET_impl(...)` plus `export
const GET = withSanitizedErrors(GET_impl)` at the end of the file), so
the effect is the same (every error response gets sanitized) even
though it's necessarily applied per-route rather than in one global
place the way Express allowed.

## Frontend: Home 01 and the dashboard

**Home 01** (the site's root page) uses the Cybal template's actual
design — hero, services, pricing, team sections — but every word of
content was replaced with real Altegic copy. Three sections from the
stock template were removed entirely rather than repurposed with
invented content, since keeping them would mean fabricating things
Altegic doesn't have: a portfolio/case-studies section (no real client
work to show), a testimonials section (fake customer names and quotes),
and a newsletter signup form (didn't connect to any real system). The
team section keeps real roles but uses generic icons instead of stock
photos of random people falsely implying they're actual employees.

**The dashboard** (`/dashboard`) is a single page with client-side
state switching between 7 panels (Mailboxes, Voice, Team Calling, Call
Centre, Domains, Projects, MVNO) — the same architecture as the Vite
version, not migrated to separate Next.js routes per panel. Every panel
was verified against real rendered HTML from a running server, not just
a successful build — since panel switching is client-side state
defaulting to the Mailboxes view, checking any other panel's actual
output required temporarily changing the default, rebuilding, checking
the served HTML, then reverting (confirmed via a clean diff each time).

**Webmail** (`/webmail-login`, `/webmail`) is the second independent
login system's UI — full inbox (list/read/compose, folder navigation,
star toggling, move to spam/trash, permanent delete, reply).

**Checkout** (`/checkout/return`, `/checkout/cancel`) are where PayFast
redirects after payment — the return page polls order status and shows
the right message for every state (`pending`, `paid`, `fulfilled`,
`failed`, `amount_mismatch`, `fulfillment_failed`).

## What's genuinely still outstanding

Stated directly, not glossed over:

1. **No live credentials for anything** — GoDaddy, Twilio, Mailgun,
   PayFast. Every external API call throughout this whole migration has
   been verified to correctly *attempt* the real call and fail cleanly
   (not crash) at the same sandbox network boundary — never a live
   response. Set real credentials before trusting any of this with a
   real customer.
2. **`MAILBOX_MONTHLY_PRICE_USD_CENTS` is unset on purpose.** Mailgun
   has no natural per-mailbox price to mark up (it bills by volume, not
   per mailbox) — this is a real business decision, not a technical
   one, and `POST /api/mailboxes` returns a clear "pricing not
   configured" error until it's set rather than guessing at a number.
3. **Domain renewal isn't modeled at all** (see above) — a pre-existing
   gap in both versions, not introduced by this rewrite.
4. **This is a preview deployment, not production.** It's running as a
   separate Railway service (`altegic-nextjs-preview`), pointed at this
   `nextapp/` folder, completely isolated from the live Express site at
   `commhub-production`. Nothing here has touched that deployment.

## Cutover

Moving this from preview to production is a real decision, not
something to do casually:

- **Replace the Express site outright** — repoint the production domain
  at this service, decommission the old one. Higher stakes, cleaner
  end state.
- **Run both in parallel for a while** — keep the Express site live,
  bring this up alongside it on its own domain/subdomain, migrate
  traffic gradually. Lower risk, more moving parts to keep straight
  (in particular: `server/data/db.json` and `nextapp/data/db.json` are
  two separate data stores — they do not share customer accounts,
  mailboxes, or orders).

Either way, this should happen only once there are real credentials to
test against and at least one real transaction has gone through
successfully — not before.
