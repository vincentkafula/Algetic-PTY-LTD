#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Mailcow install script for Altegic's self-hosted email VPS.
# Run as root (or with sudo) on a FRESH Ubuntu 24.04 LTS server.
#
# IMPORTANT — do this BEFORE running this script, not after:
#   1. Set these DNS records for the domain that will send mail:
#        mail.altegic.co.za.        A       <this-server-ip>
#        altegic.co.za.             MX  10  mail.altegic.co.za.
#        altegic.co.za.             TXT     "v=spf1 mx a -all"
#        autodiscover.altegic.co.za. CNAME  mail.altegic.co.za.
#        autoconfig.altegic.co.za.   CNAME  mail.altegic.co.za.
#   2. Ask your VPS provider to set a PTR (reverse DNS) record on this
#      server's IP, pointing back to mail.altegic.co.za. Gmail and Outlook
#      both check this — mail sent without it gets flagged almost
#      immediately.
#   3. Open ports 25, 80, 443, 110, 143, 465, 587, 993, 995 in your
#      provider's firewall/security group (in addition to the UFW rules
#      this script sets up on the server itself).
#
# See self-hosted-setup-guide.md for the full context, including the
# "Email deliverability — the real risk" section. Read that before sending
# any real customer mail through this.
# ---------------------------------------------------------------------------
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root (or with sudo)." >&2
  exit 1
fi

read -rp "Mail server hostname (e.g. mail.altegic.co.za): " MAILCOW_HOSTNAME
if [ -z "$MAILCOW_HOSTNAME" ]; then
  echo "A hostname is required." >&2
  exit 1
fi

echo "== Installing prerequisites =="
apt-get update
apt-get install -y git docker.io docker-compose-plugin ufw

echo "== Opening required ports in UFW =="
for port in 25 80 443 110 143 465 587 993 995; do
  ufw allow "$port"/tcp || true
done

echo "== Cloning mailcow-dockerized =="
cd /opt
if [ -d mailcow-dockerized ]; then
  echo "mailcow-dockerized already exists in /opt — skipping clone, using existing checkout."
else
  git clone https://github.com/mailcow/mailcow-dockerized
fi
cd mailcow-dockerized

echo "== Generating config for hostname: $MAILCOW_HOSTNAME =="
echo "$MAILCOW_HOSTNAME" | ./generate_config.sh

echo "== Pulling images and starting Mailcow (this can take several minutes) =="
docker compose pull
docker compose up -d

echo ""
echo "== Done =="
echo "Mailcow is starting up. Next steps:"
echo "  1. Wait a minute or two for all containers to finish starting, then open"
echo "     https://$MAILCOW_HOSTNAME"
echo "  2. Log in with the default admin / moohoo — CHANGE THIS PASSWORD"
echo "     IMMEDIATELY under Configuration > Access."
echo "  3. Configuration > Mail Setup > Domains -> add your sending domain."
echo "  4. Configuration > ARC/DKIM keys -> generate a key, add the shown TXT"
echo "     record to your DNS."
echo "  5. Add a _dmarc TXT record: v=DMARC1; p=none; rua=mailto:you@yourdomain"
echo "     (start with p=none — monitor only — until you've confirmed mail is"
echo "     actually delivering correctly)."
echo "  6. Configuration > Access > API -> generate a read-write API key and"
echo "     allow-list this app server's own outbound IP, so the Altegic app"
echo "     can create mailboxes and send/receive on its behalf."
echo "  7. Send yourself a test message from a real Gmail account and confirm"
echo "     it arrives — do this before pointing any real customer mail here."
echo ""
echo "Full walkthrough, including the deliverability warnings: self-hosted-setup-guide.md, Part 3."
