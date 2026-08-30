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
- **`rtpengine.conf.template` — NOT runtime-tested.** Installing
  `rtpengine-daemon` during development hit a broken package mirror (an
  unrelated `libmysqlclient21` fetch failure in its dependency chain) that
  blocked getting the actual binary running to verify this file. The
  config is based on a verified real-world working example, not
  guesswork, but this is meaningfully less certain than the Kamailio
  piece. **Test this file for real on your VPS before trusting it.**
- **`docker-compose.yml` and both Dockerfiles — not built or run.** No
  Docker daemon was available in the development sandbox. `network_mode:
  host` is the standard, widely-documented pattern for dockerized SIP
  servers (not improvised for this project), and the package names/versions
  were confirmed installable via `apt-get` on the exact same Ubuntu 24.04
  base — but the actual `docker build` / `docker compose up` has not been
  exercised. Budget time for troubleshooting the first real run.
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
- Firewall rules (both the OS firewall and any cloud provider security
  group) opening:
  - `5060/udp` and `5060/tcp` — SIP signaling
  - Your chosen `RTP_PORT_MIN`–`RTP_PORT_MAX` range, UDP — actual call
    audio. The `.env.example` default (30000–31000) is 1,000 ports, enough
    for 500 simultaneous calls (2 ports each) — plenty for a private team
    network; narrow or widen as needed.

## Deploy

```bash
cd sip-network
cp .env.example .env
# edit .env: your VPS's real public IP, your SIP domain, RTP port range
docker compose up -d --build
```

Watch the logs on first run — this is the untested-in-sandbox part:

```bash
docker compose logs -f
```

## Managing subscribers

```bash
./scripts/add-user.sh alice a-strong-password
./scripts/list-users.sh
./scripts/remove-user.sh alice
```

Each user configures their SIP phone or softphone with:
- **SIP server / domain:** whatever you set `SIP_DOMAIN` to
- **Username:** what you passed to `add-user.sh`
- **Password:** what you passed to `add-user.sh`

There's no password recovery — if someone forgets theirs, add them again
with a new password (the script updates in place if the username already
exists).

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
