# CommHub private SIP network

A self-hosted VoIP system for calling between people registered on your own
server — real SIP/IP-phone hardware and softphones, digest-authenticated,
zero telecom carrier involved. This is a genuinely separate deployment from
the rest of CommHub: it runs on its own VPS, not on Railway.

## What this is / isn't — read this first

**Is:** a real SIP registrar and call router (Kamailio) with a media relay
(rtpengine) that lets registered users call each other by SIP address,
authenticated, with no telecom carrier anywhere in the chain.

**Isn't:** a way to reach or be reached by ordinary phone numbers. There is
no PSTN gateway, no trunk, nowhere else for a call to go. An INVITE to
anyone not currently registered on this exact server gets rejected with
`404 User not registered on this network` — by design, not as a bug to fix
later. If you need real phone numbers, that's the Twilio-based
`server/services/trunking.js` piece of the main CommHub app, which is a
completely different, carrier-backed system.

**Why not Railway:** SIP needs a stable public IP and, more importantly,
actual audio (RTP) needs a wide UDP port range reachable from the internet.
Railway (like most PaaS platforms) only exposes TCP. This needs a real VPS
where you control the firewall directly — DigitalOcean, Hetzner, a bare
server, anything that gives you a public IP and full port control.

## What's been verified vs. what hasn't

Being direct about this, because it matters for how much to trust each part
before you rely on it in production:

- **`kamailio.cfg.template` — verified for real.** Kamailio 5.7.4 (the same
  version Ubuntu 24.04 ships) was actually installed and run during
  development, not just read about. Confirmed with real SIP packets: a
  digest-authenticated REGISTER persists a subscriber, an unauthenticated
  INVITE gets challenged (`407`) before any routing happens, an
  authenticated INVITE to an unregistered user gets rejected (`404`), and
  an authenticated INVITE to a registered user gets relayed (`100
  Trying`). Three real configuration bugs were found and fixed this way —
  a missing NAT flag, a missing shared `received_avp` parameter between
  two modules, and an empty-string auth realm this Kamailio version
  rejects outright.
- **`manage_subscribers.py` — verified for real.** Tested adding, updating,
  removing, and listing subscribers, then confirmed a subscriber added
  through the script successfully authenticates against a live Kamailio
  instance.
- **`api/server.js` (the management API) — verified for real.** Full CRUD
  flow tested against a real Kamailio-schema SQLite database, including
  auth rejection and input validation. Confirmed its HA1/HA1B hashes are
  byte-identical to the formula already proven to authenticate against
  live Kamailio. The full chain — CommHub dashboard → CommHub backend →
  this API → the database — was tested end-to-end locally.
- **`rtpengine.conf.template` — NOT runtime-tested.** Installing
  `rtpengine-daemon` during development hit a broken package mirror (an
  unrelated `libmysqlclient21` fetch failure in its dependency chain) that
  blocked getting the actual binary running to verify this file. The
  config is based on a verified real-world working example, not
  guesswork, but this is meaningfully less certain than the Kamailio
  piece. **Test this file for real on your VPS before trusting it.**
- **`docker-compose.yml`, the Dockerfiles, and the Caddyfile — not built
  or run.** No Docker daemon was available in the development sandbox.
  `network_mode: host` is the standard, widely-documented pattern for
  dockerized SIP servers (not improvised for this project), the package
  names/versions were confirmed installable via `apt-get` on the exact
  same Ubuntu 24.04 base, and Caddy's `{$VAR}` substitution syntax was
  confirmed against current Caddy documentation — but none of that is the
  same as actually running `docker compose up` and watching it work.
  Budget time for troubleshooting the first real run.
- **Nothing here proves real-world NAT traversal.** All testing happened
  between processes on `127.0.0.1` inside one sandbox. Two phones behind
  two different home routers on the real internet is a materially
  different (and materially harder) test that can only happen on the real
  VPS.

## VPS requirements

- A VPS with a real public IPv4 address (DigitalOcean, Hetzner, Linode,
  etc. — any provider that isn't a PaaS with a restricted network model)
- Ubuntu 24.04 recommended, since that's what this was built and tested
  against
- Docker and Docker Compose installed
- A DNS A record pointing `API_DOMAIN` (from `.env`) at this VPS's IP, if
  you want the CommHub dashboard integration — Caddy needs this to obtain
  a TLS certificate
- Firewall rules (both the OS firewall and any cloud provider security
  group) opening:
  - `5060/udp` and `5060/tcp` — SIP signaling
  - Your chosen `RTP_PORT_MIN`–`RTP_PORT_MAX` range, UDP — actual call
    audio. The `.env.example` default (30000–31000) is 1,000 ports, enough
    for 500 simultaneous calls (2 ports each) — plenty for a private team
    network; narrow or widen as needed.
  - `80/tcp` and `443/tcp` — only needed if you're using the management
    API/dashboard integration (Caddy needs 80 for Let's Encrypt's
    challenge, 443 to serve the API over HTTPS). Skip these if you're only
    ever going to manage subscribers via the command-line scripts.

## Deploy

```bash
cd sip-network
cp .env.example .env
# edit .env: your VPS's real public IP, your SIP domain, RTP port range,
# and (if you want the dashboard integration) SIP_API_KEY + API_DOMAIN
docker compose up -d --build
```

Watch the logs on first run — this is the untested-in-sandbox part:

```bash
docker compose logs -f
```

If you're using the dashboard integration, also set `SIP_NETWORK_API_URL`
(`https://<API_DOMAIN>`) and `SIP_NETWORK_API_KEY` (matching `SIP_API_KEY`
exactly) on the main CommHub app — see its `server/.env.example`.

## Managing subscribers

Two ways to do this — pick whichever fits:

**From the CommHub dashboard** (once you've set `SIP_NETWORK_API_URL` and
`SIP_NETWORK_API_KEY` on the main CommHub app — see its
`server/.env.example`): the dashboard's "Private SIP network" panel talks
to the `api` service below over HTTPS. This is the easier path day-to-day.

**From the command line, directly on the VPS:**

```bash
./scripts/add-user.sh alice a-strong-password
./scripts/list-users.sh
./scripts/remove-user.sh alice
```

Both paths write to the exact same database — use whichever is convenient,
they don't conflict.

Each user configures their SIP phone or softphone with:
- **SIP server / domain:** whatever you set `SIP_DOMAIN` to
- **Username:** what you passed to `add-user.sh` (or the dashboard)
- **Password:** what you passed to `add-user.sh` (or the dashboard)

There's no password recovery — if someone forgets theirs, add them again
with a new password (both paths update in place if the username already
exists).

## The management API and dashboard integration

The `api` service (in `sip-network/api/`) is a small Express app that
shares the same `kamailio-data` Docker volume as Kamailio itself — it
reads and writes the exact same SQLite file, using the exact HA1/HA1B hash
formula validated against real Kamailio auth during development (see
above). It's fronted by Caddy for automatic HTTPS, and protected by a
single shared `SIP_API_KEY` — treat that key like a root password for your
subscriber list.

**Verified for real:** the API's full CRUD flow (add, update, list,
remove, auth rejection, validation) was tested against a real
Kamailio-schema SQLite database, and the HA1 hashes it produces were
confirmed byte-identical to the formula already proven to authenticate
against live Kamailio. The full chain — CommHub dashboard → CommHub
backend → this API → the database — was also tested end-to-end locally.

**Not verified:** Caddy's automatic HTTPS itself (no Docker daemon
available during development, same limitation as rtpengine above) — the
Caddyfile uses Caddy's standard, documented `{$API_DOMAIN}` substitution
syntax, but confirm a certificate actually issues once this is deployed.

**Scoping:** unlike CommHub's mailboxes and phone numbers, subscribers
here are **not** isolated per CommHub customer account. Every CommHub
account with dashboard access manages the same shared list. That's the
right shape for "my own team's private calling system" — it is not a
multi-tenant, resell-to-separate-customers feature. Adding that would mean
an account-tag column on the `subscriber` table, filtered throughout
`api/server.js`.

## Testing a first call

Register two softphones (e.g. [Zoiper](https://www.zoiper.com/) or
[Linphone](https://www.linphone.org/) on two different devices/networks)
with two different usernames against your `SIP_DOMAIN`, then call one from
the other by username. If it doesn't work, check in this order:

1. Do both phones show "registered" in their own UI? If not, it's a
   signaling/firewall problem — check `5060/udp` is actually open.
2. Does the call connect but no audio? That's the RTP path — check the
   `RTP_PORT_MIN`–`RTP_PORT_MAX` range is open, and check rtpengine's own
   logs (`docker compose logs rtpengine`) since that piece wasn't
   runtime-verified during development.
3. Does the call fail immediately with `404`? Double-check both usernames
   are actually registered (`./scripts/list-users.sh` and check each
   phone's registration status).

## Backups

Everything — every subscriber, every credential — lives in the
`kamailio-data` Docker volume (`/etc/kamailio/kamailio.db` inside the
container). Back this up. There's no cloud sync, no redundancy, no
automatic recovery built in here.

## Scaling and production-hardening beyond this starter

- **TLS for SIP signaling** (`sips:`) — this config runs plain UDP/TCP SIP,
  fine for testing, but real deployments typically want TLS so credentials
  and call setup aren't sent in the clear
- **SRTP for media encryption** — same reasoning, applies to the audio
  itself
- **In-kernel rtpengine forwarding** — this config runs rtpengine in
  userspace mode; worth revisiting if you get into the hundreds of
  concurrent calls, where kernel-module forwarding meaningfully reduces
  CPU load
- **Fail2ban or similar** on the SIP port — any public SIP server on the
  internet gets scanned and probed constantly; this starter has no
  rate-limiting or ban-on-failed-auth mechanism built in
- **Monitoring/alerting** if this becomes something people depend on daily
