# Altegic — reseller panel for email + VoIP

Altegic is a starter for a SaaS product that lets you sign customers up for
branded mailboxes (usable in Outlook) and phone numbers (usable on IP
phones/softphones), by reselling **Mailgun** (email) and **Twilio** (voice)
under your own dashboard. It is not, and cannot be, a from-scratch mail
server or telecom carrier — see [What this is / isn't](#what-this-is--isnt)
below.

This version adds the pieces a one-off demo is usually missing before it's
safe to put in front of real customers:

- **Account signup/login** (JWT sessions, bcrypt-hashed passwords)
- **Per-account data isolation** — customer A can never see customer B's
  mailboxes or numbers
- **Persistent storage** that survives a server restart
- **Delete/release** endpoints for mailboxes and numbers, not just create
- Basic request logging and a JSON error handler

It's still a starter, not a finished, audited product — see
[Before you charge real customers](#before-you-charge-real-customers).

## Run it locally

```bash
cd server
npm install
cp .env.example .env
```

Open `server/.env` and set at minimum:

```bash
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
```

(or just paste a long random string in directly). Then:

```bash
npm start
```

Open **http://localhost:4000** for the landing page. Click **Get started**
to create an account, which drops you into the dashboard at
`/dashboard.html`. Every mailbox and number you create is tied to that
account.

## Adding your real API keys — do this yourself, not in a chat

Never paste real API keys into an AI chat, a shared doc, or a git commit.
Put them only in `server/.env` (already covered by `.gitignore`).

- **Mailgun**: sign up at mailgun.com, verify a sending domain, get your API
  key from the dashboard. Put it in `MAILGUN_API_KEY` / `MAILGUN_DOMAIN`.
- **Twilio**: sign up at twilio.com, grab your Account SID and Auth Token
  from the console. Put them in `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`.

Once both are filled in, restart the server and the dashboard's status
banner flips from "Demo mode" to "Connected." Signup/login work even without
Mailgun/Twilio configured — you'll just get a clear error if you try to
create a mailbox or search numbers before adding those keys.

## What this is / isn't

**Is:** a dashboard + API layer that calls real Mailgun and Twilio APIs to
provision addresses and phone numbers, with accounts, auth, and storage
wired up so you can start layering your actual business logic and billing
on top.

**Isn't:** a replacement for running Postfix/Dovecot or becoming a licensed
telecom carrier yourself. Those are what Mailgun and Twilio already do
underneath — Altegic resells access to them, it doesn't reimplement them.
That's true of essentially every "build me email + VoIP hosting" product;
the deliverability and carrier relationships are the hard, slow-to-earn part,
and nobody rebuilds them from zero for a new SaaS.

## Architecture

```
server/
  server.js              Express app, mounts routes, health check
  db.js                  JSON-file persistence (users, mailboxes, numbers)
  middleware/auth.js     JWT verification, attaches req.user
  routes/auth.js         POST /signup, /login, GET /me
  routes/mailboxes.js    CRUD over Mailgun routes, scoped to req.user
  routes/numbers.js      CRUD over Twilio numbers, scoped to req.user
  data/db.json           created on first run — your actual data lives here
public/
  index.html             marketing/landing page
  login.html             combined login + signup form
  dashboard.html         the panel itself (requires a session)
  auth.js                shared frontend session helper (authedFetch, etc.)
  app.js                 dashboard behaviour: create/list/delete mailboxes & numbers
```

Every `/api/mailboxes/*` and `/api/numbers/*` route requires a bearer token
issued by `/api/auth/login` or `/api/auth/signup`, and every record written
to `db.json` carries an `ownerId` that ties it to one account. There is no
"admin sees everyone" view in this starter — you'd add that as a separate,
explicitly-scoped role if you need one.

## Data storage: what's here vs. what you need for production

`server/db.json` is a single JSON file with a small write queue to avoid
corrupting itself under concurrent requests. It's enough to develop against
and to demo, but it is **not** a real database:

- No concurrent-write safety across multiple server processes/instances
- No indexes — every query is a full-array scan (fine at hundreds of rows,
  not at hundreds of thousands)
- No backups beyond whatever file-level backup you set up yourself

Before real customers touch this, swap `server/db.js` for Postgres (or
similar) behind the same four functions (`find`, `filter`, `insert`,
`remove`/`update`) so the route files don't need to change. Also move
`JWT_SECRET` and provider keys into a proper secrets manager rather than a
plaintext `.env` file on the box.

## Email: send and receive, and the gap that remains

Mailgun is built for **sending and inbound routing** (forward mail, hit a
webhook), not for storing mail behind an IMAP login the way Outlook expects.
This starter now does both send and receive for real:

- **Sending**: `POST /api/mailboxes/:id/send` calls the Mailgun Messages API
  directly from a mailbox's address, and records the sent message.
- **Receiving**: if `PUBLIC_BASE_URL` and `MAILGUN_WEBHOOK_SIGNING_KEY` are
  set (see `server/.env.example`), each new mailbox's Mailgun route
  forwards inbound mail to this app's own webhook
  (`routes/webhooks.js`), which verifies Mailgun's signature and stores the
  message so it shows up in the dashboard and via `GET
  /api/mailboxes/:id/messages`. Without those two variables set, mailboxes
  still work but fall back to plain forwarding only — nothing is captured
  or shown in the dashboard. A mailbox's `inboundCaptureEnabled` field
  tells you which mode it's in.
- **Webhook security**: Mailgun's inbound signature uses a **separate
  "HTTP webhook signing key"**, not `MAILGUN_API_KEY` — Mailgun split these
  so a leaked sending key can't be used to forge inbound webhook calls.
  Find it in the Mailgun dashboard under Settings → API Keys. The webhook
  route rejects any request whose signature doesn't verify before it's
  allowed to touch storage.
- **Storage caveat**: message bodies are capped at 5,000 characters and
  live in the same JSON file as everything else in this starter — fine for
  development, not for real mail volume. See the database section above.

What's still missing — a real Outlook-style "type in your email and
password" login — needs actual IMAP, which Mailgun doesn't provide. Two
realistic paths if you need that:

1. **Pair Mailgun's inbound routing with your own mail store** — run
   Dovecot (IMAP server) behind the scenes, have Mailgun forward incoming
   mail into it. More control, more ops work (you're back to running mail
   server infrastructure, just for storage rather than delivery/reputation).
2. **Use a provider that does IMAP natively** — e.g. Migadu, Amazon WorkMail,
   or Microsoft 365 as a backend you resell, instead of Mailgun. Less ops
   work, but you're reselling someone else's mailbox product under your
   brand rather than fully owning the stack.

`routes/mailboxes.js` also supports deleting a mailbox (removes the Mailgun
route, the local record, and that mailbox's captured message history).

## Voice: SIP trunking

- Number search and purchase (`routes/numbers.js`) calls real Twilio APIs,
  and releasing a number calls Twilio to release it (stops billing), not
  just deletes the local row.
- Each account gets its own dedicated Twilio Elastic SIP Trunk and
  Credential List (`server/services/trunking.js`), created automatically the
  first time that account provisions a number. Every number an account
  provisions afterward is attached to that same trunk — one customer's
  credentials can never be used to place calls billed to another account.
- **Read this before promising customers "just enter these details into any
  softphone":** Twilio Elastic SIP Trunking does not accept SIP REGISTER.
  A trunk only delivers inbound calls to a static **origination address** —
  the public SIP address of a PBX, session border controller, or a
  softphone with a stable, reachable address. The dashboard's "Set
  origination address" field is exactly that — it is not a registration
  step, and there's no way to make an arbitrary softphone with no fixed
  address "just work" using this trunk-based approach.
  - If the product needs literal registration-based softphones (no static
    address required), that's a different Twilio product — Programmable
    Voice **SIP Domains** with registration-based credential auth, plus a
    TwiML voice handler that dials the currently-registered contact. That's
    a legitimate separate feature to build, not an extension of the trunk
    code here.
- SIP passwords are generated with `crypto.randomBytes` and are never
  stored — Twilio holds the credential, and this app only shows the
  password once, at creation or reset time (`POST
  /api/numbers/trunk/reset-password`). If a customer loses it, reset it;
  there's no "forgot password" recovery by design, same as any API key.
- If trunk setup fails after a number is already purchased, the route rolls
  back by releasing the number from Twilio, so a failed request doesn't
  leave an orphaned, billed number with no way to manage it from the
  dashboard.

## Call centre: IVR, queues, and agents

Built on top of the phone numbers/Twilio integration above — `routes/callCentre.js`
(CRUD for menus/queues/agents, scoped per Altegic account like mailboxes and
numbers) and `routes/callCentreWebhooks.js` (the actual TwiML call-flow logic
Twilio calls into).

**Mutually exclusive with SIP trunking, per number.** A Twilio phone number
can be attached to a SIP trunk (direct-dial IP phones, described above) *or*
have its own Voice URL webhook (IVR/queue routing, this feature) — Twilio
only honors one at a time; trunk attachment makes Twilio ignore that
number's Voice URL entirely. Assigning a number to a call-centre menu
automatically detaches it from any trunk it was on.

**Verified for real:**
- The full CRUD flow — auth enforcement, input validation (bad digits,
  invalid actions, malformed phone numbers) — tested with real HTTP
  requests.
- **Twilio webhook signature verification**, the security foundation these
  webhooks depend on since they're unauthenticated (Twilio calls them
  directly, no Altegic session involved): generated real valid signatures
  with Twilio's own library, confirmed forged/unsigned requests are
  rejected (403), confirmed correctly-signed ones are accepted. This isn't
  optional hardening — without it, anyone who finds these URLs could inject
  fake call events.
- **Every branch of the call-routing logic**, checked against actual TwiML
  XML output: pressing a digit that dials out, one that hangs up with a
  message, an invalid digit (redirects back to the menu start), and one
  that enqueues a caller. All confirmed byte-correct, not just "should
  work."
- The dashboard panel's exact API call shapes, tested end-to-end against a
  running server.

**NOT verified — read before relying on it:** placing an actual phone call
isn't possible from a development sandbox, so the "ring every available
agent, first to answer gets bridged to the caller" flow
(`notifyAgents()` in `callCentreWebhooks.js`) has never rung a real phone.
It's built on Twilio's own officially documented pattern for exactly this
(`<Enqueue>` a caller, separately `<Dial><Queue>` from each agent's
answered leg — confirmed against current Twilio docs), not guesswork, but
your first real inbound call is the actual test of that piece.

**Agents answer on a real phone, not a browser.** When someone reaches a
queue, Altegic places outbound calls to every available agent's registered
phone number (their cell, a desk phone, or a private-SIP-network extension
if you've made it independently reachable — the private SIP network has no
PSTN connectivity by default, see its own README). This was a deliberate
scope decision — a browser-based softphone (Twilio Voice SDK, WebRTC,
microphone permissions, a token-issuing endpoint) is a materially larger,
separate feature that wasn't built here.

## MVNO operations (demo dashboard)

`routes/mvno.js` — a network operations center (NOC) style dashboard: subscribers,
cell towers, fraud alerts, billing, support tickets, and roaming partners.
**Every number is simulated.** There's no real telecom core network behind
this — no real HLR/HSS, no real cell towers, no real subscribers. The
dashboard says so directly, with a persistent demo banner, not a small-print
footnote.

This mirrors the reference implementation at
[github.com/vincentkafula/VINK-GRUP-LIMITED](https://github.com/vincentkafula/VINK-GRUP-LIMITED),
which runs the identical NOC-style dashboard on generated demo data whenever
its real backend isn't reachable. The difference here: Altegic has no real
backend to fall back *from* — this is demo-only by design, not a fallback
mode.

**Why this can't become "real" the way the other six services did:** Email,
voice, and domains all work because Mailgun/Twilio/GoDaddy already operate
the underlying infrastructure and sell API access to it. There is no
equivalent "MVNO-as-an-API" product — running a real mobile network requires
an actual MVNE/MNO wholesale relationship (spectrum access, HLR/HSS
integration), which is a telecom licensing and commercial negotiation, not
an integration this codebase can add. If that relationship exists someday,
this dashboard is the right shape to wire real data into — the seeded
demo-data generator (`makeRng` in `routes/mvno.js`) is deliberately isolated
in one function so swapping it for real API calls doesn't touch the routes,
the response shapes, or the frontend at all.

**Verified for real:** every endpoint tested end-to-end — auth enforcement,
correct response shapes, and the seeded random generator confirmed to
produce stable numbers across repeated requests within the same day (so the
dashboard doesn't visibly re-randomize on every page load, without needing
to persist anything).

## Domain registration (GoDaddy)

`routes/domains.js` integrates GoDaddy's v3 "quote-execute" Domains API:
search availability, get a locked price quote, then execute the
registration. Scoped per Altegic account like mailboxes and numbers.

**Registering a domain charges the connected GoDaddy account's payment
method and is not reversible** — this is GoDaddy's own characterization of
the operation, not caution added here for effect. The flow is deliberately
three separate steps (search → quote → register), never one:

- `POST /api/domains/register` **refuses to proceed** unless the request
  includes `agreedAgreementTypes` as a non-empty array — a server-side
  backstop against a frontend bug skipping the consent step, tested
  directly (both a missing field and an empty array are rejected before
  any network call to GoDaddy is made).
- The dashboard shows the locked price, the renewal price, and every
  agreement GoDaddy requires (with a checkbox per agreement) before the
  "Register this domain now" button does anything, then asks for one more
  explicit browser confirmation before submitting.
- An `Idempotency-Key` header is sent on every registration attempt, so a
  network retry can't double-charge.

**Verified for real:** the full request/response shape, auth enforcement,
input validation, and — critically — the consent backstop were all tested
against a running server. **Not verified:** an actual domain registration
against a live GoDaddy account, since that means real, non-refundable
money — there was no GoDaddy account available to test against during
development. The search/quote endpoints (read-only, free, no account
interaction) are the safe first things to try once `GODADDY_PAT` is set.

### DNS record management

Once a domain is registered, `routes/domains.js` also lists, adds, replaces,
and deletes its DNS records (A, AAAA, CNAME, TXT, MX) via GoDaddy's v3 zone
API, surfaced in the dashboard's "DNS records" panel.

**Security note specific to this piece:** `GODADDY_PAT` is one credential
covering every domain in the connected GoDaddy account — unlike Twilio or
Mailgun, it isn't scoped per resource by the provider itself. Every DNS
route therefore checks that the domain in the URL matches a record this
specific Altegic account registered *through Altegic* (in the local
`domains` collection) before doing anything — tested directly with two
separate accounts, confirming one account gets a 404 (not the DNS data)
when it tries to touch a domain it doesn't own. A domain registered
directly in GoDaddy, outside Altegic, has no local record to match against
and so can't be managed from this dashboard at all — by design, not a gap
to fix.

**Verified for real:** the ownership check itself, and all input
validation. **Not verified:** an actual DNS write against a live zone,
same reason as registration above — no live account to test against.

interaction) are the safe first things to try once `GODADDY_PAT` is set.

## Website & software development requests

`routes/projects.js` — a lightweight request tracker (`Requested` → `In
Progress` → `Delivered`/`Cancelled`), not an automated build service.
There's no API that produces a website or custom software on demand; a
real person still designs and builds the work. This just gives that work a
visible pipeline inside the same dashboard, scoped per account like
everything else.

No staff/customer role distinction exists yet — any logged-in account can
update any of its own requests' status. If the real workflow needs "the
customer requests, your team updates status," that's a role system to add
on top of this data model, not a rebuild of it.

## South Africa and Zambia

Both are included in `SUPPORTED_NUMBER_COUNTRIES` and the dashboard's country
list. Before relying on them:

- **South Africa (ZA)**: Twilio does sell numbers here, but local and mobile
  South African numbers require a **regulatory bundle** (proof of address)
  approved on your Twilio account before a purchase completes — a search can
  return results that still fail at the provision step until that's done.
  Check Twilio's regulatory requirements for South Africa in your console.
- **Zambia (ZM)**: Twilio has confirmed voice and SMS coverage for Zambia,
  but this project hasn't verified whether *local* Zambian numbers are
  available for direct purchase via the API — that's a narrower capability
  than call/SMS coverage. Test a number search for ZM in your own Twilio
  console first. If it comes back empty, Zambian numbers may need to be
  requested through Twilio support rather than bought directly — in that
  case, remove `ZM` from `SUPPORTED_NUMBER_COUNTRIES` until confirmed.

## Private SIP network (no telecom carrier)

`sip-network/` is a separate, self-hosted alternative to the Twilio-based
voice piece above — a SIP registrar and call router (Kamailio + rtpengine)
that lets registered users call each other with zero carrier involvement.
It cannot reach or be reached by real phone numbers, and it runs on its own
VPS, not on Railway — see `sip-network/README.md` for the full scope,
what's been verified vs. not, and deployment steps.

## China

Numbers for China are intentionally excluded from `SUPPORTED_NUMBER_COUNTRIES`
and disabled in the dashboard's country dropdown. Reselling Chinese telephone
numbers or running a VoIP service reachable in China generally requires a
license from China's Ministry of Industry and Information Technology (MIIT)
and a China-registered entity — this isn't something a foreign-registered
reseller can add via an API key. If China is a hard requirement, the usual
route is a commercial partnership with an already-licensed local carrier who
handles that leg, while you keep reselling US/CA/UK numbers directly.

## Before you charge real customers

- Swap the JSON file store for a real database (see above)
- Support multiple origination URIs per trunk (Twilio allows up to 10) for
  failover, rather than this starter's single address
- KYC on customers provisioning phone numbers — carriers require this, and
  it's your main defense against fraud/abuse burning your account
- Rate limiting on `/api/auth/*` (this starter has none — add something like
  `express-rate-limit` before going live, or brute-forcing a password
  becomes trivial)
- CAN-SPAM / GDPR handling for the email side
- A real billing integration (Stripe subscriptions/metered usage) tied to
  mailbox count and call/SMS usage
- Terms of service covering acceptable use — this is what stops your
  platform from being used for spam or robocalling, which gets accounts
  suspended by Mailgun/Twilio regardless of what your own ToS says
- HTTPS in front of this (a reverse proxy like Caddy/Nginx, or a platform
  that terminates TLS for you) — right now it's plain HTTP for local dev
