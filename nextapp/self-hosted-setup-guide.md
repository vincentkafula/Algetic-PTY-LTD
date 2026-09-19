# Self-hosted email & website hosting — setup guide for Altegic

This is the runbook for moving from reselling Mailgun (email) and relying on
Railway (Altegic's own app hosting) toward Altegic running its own hosting
infrastructure — website hosting like Railway, email hosting like GoDaddy —
on a VPS you control.

**Read the "Email deliverability — the real risk" section before you commit
a live customer domain to this.** It's the one part of this plan that can
quietly break things for weeks if skipped.

---

## Part 0 — What you're actually building

Two genuinely different systems, both running as Docker containers on the
same (or separate) VPS:

1. **Coolify** — an open-source, self-hosted platform-as-a-service. This is
   the closest real equivalent to Railway: connect a Git repo, it builds
   and deploys your app, gives you a dashboard, handles HTTPS automatically.
2. **Mailcow** — an open-source, self-hosted mail server suite (Postfix +
   Dovecot + Rspamd + SOGo webmail), the closest real equivalent to
   GoDaddy's email hosting. Runs your own SMTP/IMAP, your own webmail, your
   own spam filtering.

Neither of these is something Claude can install for you remotely — they
require SSH access to a real server. This guide is written so you (or
whoever has server access) can follow it step by step.

---

## Part 1 — Get a VPS

### Recommended specs

| | Coolify (website hosting) | Mailcow (email hosting) |
|---|---|---|
| CPU | 2–4 vCPU | 2–4 vCPU |
| RAM | 4 GB minimum, 8 GB for production | 6 GB minimum |
| Storage | 40–80 GB SSD | 20 GB minimum, 50 GB+ for multiple mailboxes |
| OS | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |

**Run them on separate VPS instances if the budget allows it.** Mailcow is
resource-hungry (ClamAV antivirus scanning alone wants real RAM) and mail
server misconfiguration is more sensitive to noisy neighbors than a web app
is. If budget is tight, one larger VPS (8 vCPU, 16 GB RAM) can run both, but
expect to tune resource limits.

### Providers worth considering

Hetzner, DigitalOcean, and Contabo are all commonly used for this exact
setup and support the required specs at reasonable prices. Whichever you
pick, you need:
- **A dedicated (not shared) public IPv4 address** — mail delivery
  specifically depends on this
- **Reverse DNS (PTR) control** — ask the provider directly whether you can
  set a custom PTR record on the IP before signing up; this is mandatory
  for mail deliverability and not every budget VPS provider offers it

---

## Part 2 — Website hosting with Coolify

### Install

Use `setup-scripts/install-coolify.sh` (copy it to the VPS and run it
there — see `setup-scripts/README.md`), or run the same command it wraps
directly:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

This installs Docker, Docker Compose, Traefik (reverse proxy), and Coolify
itself. Takes a few minutes.

### First steps after install

1. Open `http://<your-server-ip>:8000` and create your admin account
   immediately — this port is open to the world until you do.
2. Point a subdomain (e.g. `hosting.altegic.co.za`) at the server's IP via
   an A record, then set that domain in Coolify's settings so the
   dashboard itself gets HTTPS and you can close off direct IP:8000 access.
3. Connect your GitHub/GitLab account under **Sources**.
4. **New Resource → Application** → pick the repo → Coolify auto-detects
   the stack via Nixpacks (Node.js, Python, Go, static sites, etc. all
   work without extra config for a standard app).
5. Set the app's own domain (e.g. a customer's `theirdomain.com`), point
   its DNS A record at your server IP, and Coolify issues Let's Encrypt
   HTTPS for it automatically once DNS resolves.

### What this gives Altegic

A genuine, branded alternative to "point your GoDaddy hosting at us" —
customers get a real subdomain or their own domain pointed at Altegic's own
server, deployed from their own repo or a template Altegic maintains for
them. This is a real service you can sell once it's running; it isn't
simulated.

---

## Part 3 — Email hosting with Mailcow

### DNS records to prepare *before* installing

Set these at whichever registrar controls the domain that will send mail
(e.g. `altegic.co.za` itself, or each customer's own domain if Altegic is
hosting mail per-customer):

```
mail.altegic.co.za.        A       <your-server-ip>
altegic.co.za.             MX  10  mail.altegic.co.za.
altegic.co.za.             TXT     "v=spf1 mx a -all"
autodiscover.altegic.co.za. CNAME  mail.altegic.co.za.
autoconfig.altegic.co.za.   CNAME  mail.altegic.co.za.
```

DKIM and DMARC records come *after* install — Mailcow generates the DKIM
key itself and shows you the exact TXT record to add.

**Also request a PTR (reverse DNS) record from your VPS provider** pointing
your server's IP back to `mail.altegic.co.za` — do this before sending any
real mail. Gmail and Outlook both check this and will flag mail from a
server without one almost immediately.

### Install

Use `setup-scripts/install-mailcow.sh` (copy it to the VPS and run it
there — see `setup-scripts/README.md`; it checks for ufw/firewalld and
warns if either is active, installs the correct prerequisites and a
current Docker Engine via Docker's own official install script — not
the distro's own `docker.io` package, which Mailcow's docs specifically
advise against — then walks through the steps below interactively), or
run the equivalent commands directly:

```bash
sudo apt update && sudo apt install -y git openssl curl gawk coreutils grep jq
curl -sSL https://get.docker.com/ | CHANNEL=stable sh
sudo systemctl enable --now docker
sudo apt install -y docker-compose-plugin
git clone https://github.com/mailcow/mailcow-dockerized
cd mailcow-dockerized
./generate_config.sh
# When prompted, enter mail.altegic.co.za as the hostname
sudo docker compose pull
sudo docker compose up -d
```

Open ports 25, 80, 443, 110, 143, 465, 587, 993, 995, 4190 in your
**cloud provider's** firewall/security group (Hetzner Cloud Firewall,
DigitalOcean Cloud Firewall, etc.) — not a host-level firewall. Mailcow's
own docs explicitly warn against running ufw or firewalld on the same
host: both conflict with how Docker manages its own iptables rules for
published ports, and can silently break mail delivery. Use your
provider's firewall instead, enforced outside the VM.

Also confirm the server's clock is correct and NTP-synced
(`timedatectl status` should show "NTP synchronized: yes") — this
matters for TOTP two-factor auth and various mail timestamps.

### First steps after install

1. Log into the admin UI at `https://mail.altegic.co.za` (default
   `admin` / `moohoo` — **change this immediately**).
2. **Configuration → Mail Setup → Domains** → add `altegic.co.za`.
3. **Configuration → ARC/DKIM keys** → generate a key, add the shown TXT
   record to DNS.
4. Add a `_dmarc.altegic.co.za` TXT record:
   `v=DMARC1; p=none; rua=mailto:you@altegic.co.za` — start with `p=none`
   (monitor only) rather than `p=reject`, so a misconfiguration doesn't
   silently bounce real mail while you're still testing.
5. Create a test mailbox and send yourself mail from a Gmail account to
   confirm delivery works before pointing any real customer traffic at it.

---

## Email deliverability — the real risk, said plainly

This is the part of "host mail like GoDaddy" that's genuinely hard, and no
amount of correct Mailcow configuration removes it entirely:

**A brand-new mail server has no sending reputation.** Gmail, Outlook, and
other major providers decide whether to deliver, spam-folder, or reject
mail partly based on the *history* of the sending IP and domain — something
a new server has none of. Mailgun, SendGrid, and similar services have
spent years building and maintaining that reputation across shared
infrastructure; a new self-hosted server starts at zero.

**What this means practically:**
- Expect mail from a brand-new Mailcow instance to land in spam folders,
  or be rejected outright by some providers, for the first weeks.
- "IP warming" (sending small, gradually increasing volumes rather than
  switching everything over at once) genuinely helps, but takes time —
  there's no way to shortcut it.
- A single spam complaint or a misconfigured DKIM/SPF record early on can
  set reputation back significantly.

**The practical recommendation:** don't cut over Altegic's own production
email (or any paying customer's) to this on day one. Run it in parallel —
send low-stakes test traffic first, monitor deliverability with a tool like
mail-tester.com, and only migrate real mailboxes once you've confirmed mail
is actually landing in inboxes, not spam folders, across Gmail, Outlook,
and Yahoo specifically (the three that matter most).

---

## Part 4 — Connecting this to the Altegic app

**This part is already built** — `src/lib/mailcowClient.js` and
`src/lib/emailProvider.js` are in this repo now, ready to activate. Once
Mailcow is running and its deliverability is confirmed (do not skip that
confirmation), switching the app over is a config change, not a code
change:

1. Set these in the app's environment (Railway's variables, not this
   VPS):
   ```
   EMAIL_PROVIDER=mailcow
   MAILCOW_API_URL=https://mail.altegic.co.za
   MAILCOW_API_KEY=<a read-write key from Configuration > Access > API>
   MAILCOW_DOMAIN=altegic.co.za
   MAILCOW_SMTP_HOST=mail.altegic.co.za
   MAILCOW_SMTP_PORT=587
   MAILCOW_IMAP_HOST=mail.altegic.co.za
   MAILCOW_IMAP_PORT=993
   MAILCOW_CREDENTIAL_ENCRYPTION_KEY=<any long random string>
   ```
2. In Mailcow's own admin UI, allow-list the Altegic app server's
   outbound IP under Configuration > Access > API — Mailcow rejects API
   calls from any IP not explicitly allowed, regardless of API key.
3. New mailboxes created after this point are provisioned as real
   Mailcow mailboxes (via `createMailboxForAccount`); sending goes out
   over real SMTP as that specific mailbox; opening a webmail inbox
   pulls new mail from the mailbox's real IMAP account.
4. Existing Mailgun-provisioned mailboxes are unaffected — the switch
   only changes how NEW mailboxes and sends behave going forward. There
   is no built-in migration of already-existing Mailgun mailboxes to
   Mailcow; that would be a deliberate, separate decision, not something
   this config flip does automatically or silently.

Leave `EMAIL_PROVIDER` unset (or anything other than `mailcow`) to keep
using Mailgun exactly as today — this is the safe default, so Mailcow
being unconfigured can never silently break the working Mailgun flow.

---

## Suggested order of operations

1. Get the VPS (or two).
2. Run `setup-scripts/install-coolify.sh` first — lower risk, no
   deliverability concerns, and gives you something usable (real website
   hosting) immediately.
3. Run `setup-scripts/install-mailcow.sh`, but treat the result as a test
   system for the first few weeks — don't point real customer mail at it
   yet.
4. Monitor deliverability with mail-tester.com and real test sends to
   Gmail/Outlook/Yahoo.
5. Once deliverability is confirmed, set `EMAIL_PROVIDER=mailcow` and the
   other `MAILCOW_*` variables in the app's environment (Part 4, above) —
   the integration itself is already built, this step just turns it on.
