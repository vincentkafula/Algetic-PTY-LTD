#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Mailcow install script for Altegic's self-hosted email VPS.
# Run as root (or with sudo) on a FRESH Ubuntu 22.04+ / Debian 11+ server.
#
# Checked directly against Mailcow's own current documentation
# (docs.mailcow.email) before writing this - not assumed from memory.
#
# IMPORTANT - do this BEFORE running this script, not after:
#   1. Set these DNS records for the domain that will send mail:
#        mail.altegic.co.za.        A       <this-server-ip>
#        altegic.co.za.             MX  10  mail.altegic.co.za.
#        altegic.co.za.             TXT     "v=spf1 mx a -all"
#        autodiscover.altegic.co.za. CNAME  mail.altegic.co.za.
#        autoconfig.altegic.co.za.   CNAME  mail.altegic.co.za.
#   2. Ask your VPS provider to set a PTR (reverse DNS) record on this
#      server's IP, pointing back to mail.altegic.co.za. Gmail and Outlook
#      both check this - mail sent without it gets flagged almost
#      immediately.
#   3. Open these ports in your CLOUD PROVIDER'S firewall/security group
#      (Hetzner Cloud Firewall, DigitalOcean Cloud Firewall, etc - NOT a
#      host-level firewall, see the warning below):
#        25, 80, 443, 110, 143, 465, 587, 993, 995, 4190
#   4. Confirm the server's clock is correct and NTP-synced
#      (`timedatectl status` should show "NTP synchronized: yes") - this
#      matters for TOTP two-factor auth and various mail timestamps.
#
# IMPORTANT - do NOT use ufw or firewalld on this server. Mailcow's own
# docs warn explicitly that host-level firewalls (ufw, firewalld) conflict
# with how Docker manages its own iptables rules for published ports, and
# can silently break mail delivery. Use your CLOUD PROVIDER's firewall
# (a security group / cloud firewall, enforced outside the VM) instead -
# this script does not touch ufw/firewalld for that reason, unlike an
# earlier version of it.
#
# See self-hosted-setup-guide.md for the full context, including the
# "Email deliverability - the real risk" section. Read that before sending
# any real customer mail through this.
# ---------------------------------------------------------------------------
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root (or with sudo)." >&2
  exit 1
fi

echo "== Checking for ufw/firewalld (Mailcow's own docs warn against running either alongside it) =="
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  echo "WARNING: ufw is active on this system. Mailcow's docs specifically warn this" >&2
  echo "causes problems with Docker's own port publishing. Disable it (ufw disable)" >&2
  echo "and rely on your cloud provider's firewall/security group instead, or expect" >&2
  echo "mail delivery issues. Continuing in 10s (Ctrl+C to stop and fix this first)..." >&2
  sleep 10
fi
if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld 2>/dev/null; then
  echo "WARNING: firewalld is active. Same issue as ufw above - disable it and use" >&2
  echo "your cloud provider's firewall instead. Continuing in 10s..." >&2
  sleep 10
fi

echo "== Installing system packages (per Mailcow's current documented prerequisites) =="
apt-get update
apt-get install -y git openssl curl gawk coreutils grep jq

echo "== Installing Docker via the official convenience script (not the distro's own package) =="
echo "Mailcow's docs specifically recommend this over apt's docker.io package, to get a"
echo "current Docker Engine version rather than whatever's in Ubuntu's own repos."
curl -sSL https://get.docker.com/ | CHANNEL=stable sh
systemctl enable --now docker

echo "== Installing the Docker Compose plugin =="
apt-get install -y docker-compose-plugin

echo "== Cloning mailcow-dockerized =="
cd /opt
if [ -d mailcow-dockerized ]; then
  echo "mailcow-dockerized already exists in /opt - skipping clone, using existing checkout."
else
  git clone https://github.com/mailcow/mailcow-dockerized
fi
cd mailcow-dockerized

echo ""
echo "== Generating config =="
echo "This will prompt you interactively for the mail server hostname"
echo "(e.g. mail.altegic.co.za) and timezone - answer those prompts now."
echo ""
./generate_config.sh

echo ""
echo "Config generated at mailcow.conf. Review it now if you want to adjust anything"
echo "(e.g. nano mailcow.conf) before continuing - press Enter once ready to start Mailcow, or Ctrl+C to stop here and adjust config first."
read -r _

echo "== Pulling images and starting Mailcow (this can take several minutes) =="
docker compose pull
docker compose up -d

echo ""
echo "== Done =="
echo "Mailcow is starting up. Next steps:"
echo "  1. Wait a minute or two for all containers to finish starting, then open"
echo "     https://<the hostname you entered>/admin"
echo "  2. Log in with the default admin / moohoo - CHANGE THIS PASSWORD"
echo "     IMMEDIATELY under Configuration > Access."
echo "  3. Configuration > Mail Setup > Domains -> add your sending domain."
echo "  4. Configuration > ARC/DKIM keys -> generate a key, add the shown TXT"
echo "     record to your DNS."
echo "  5. Add a _dmarc TXT record: v=DMARC1; p=none; rua=mailto:you@yourdomain"
echo "     (start with p=none - monitor only - until you've confirmed mail is"
echo "     actually delivering correctly; Mailcow's own docs example uses"
echo "     p=reject, which is stricter and best reserved for once you trust"
echo "     the setup)."
echo "  6. Configuration > Access > API -> generate a read-write API key and"
echo "     allow-list this app server's own outbound IP, so the Altegic app"
echo "     can create mailboxes and send/receive on its behalf."
echo "  7. Send yourself a test message from a real Gmail account and confirm"
echo "     it arrives - do this before pointing any real customer mail here."
echo ""
echo "Full walkthrough, including the deliverability warnings: self-hosted-setup-guide.md, Part 3."
