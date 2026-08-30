# CommHub — reseller panel for email + VoIP

CommHub is a starter for a SaaS product that lets you sign customers up for
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
underneath — CommHub resells access to them, it doesn't reimplement them.
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

## Email: the gap between this demo and a real mailbox product

Mailgun is built for **sending and inbound routing** (forward mail, hit a
webhook), not for storing mail behind an IMAP login the way Outlook expects.
To give customers a real "type in your email and password" Outlook setup,
you have two realistic paths:

1. **Pair Mailgun's inbound routing with your own mail store** — run
   Dovecot (IMAP server) behind the scenes, have Mailgun forward incoming
   mail into it. More control, more ops work (you're back to running mail
   server infrastructure, just for storage rather than delivery/reputation).
2. **Use a provider that does IMAP natively** — e.g. Migadu, Amazon WorkMail,
   or Microsoft 365 as a backend you resell, instead of Mailgun. Less ops
   work, but you're reselling someone else's mailbox product under your
   brand rather than fully owning the stack.

`routes/mailboxes.js` shows the Mailgun side (routing) so you can see the
API shape either way, and now also supports deleting a mailbox (removes the
Mailgun route and the local record).

## Voice: what's stubbed vs. production-ready

- Number search and purchase (`routes/numbers.js`) calls real Twilio APIs,
  and releasing a number now actually calls Twilio to release it (stops
  billing), not just deletes the local row.
- SIP credential issuance is still a **placeholder**. In production, create
  a dedicated SIP Trunk per customer (`twilioClient.trunking.v1.trunks`)
  with its own credential list, rather than one shared trunk — otherwise one
  customer's compromised IP phone could make calls billed to another
  customer's account.

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
- Per-customer SIP trunks instead of the shared placeholder credentials
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
