#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Coolify install script for Altegic's website-hosting VPS.
# Run as root (or with sudo) on a FRESH Ubuntu 24.04 LTS server.
# See self-hosted-setup-guide.md for the full context and next steps.
# ---------------------------------------------------------------------------
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root (or with sudo)." >&2
  exit 1
fi

echo "== Checking OS =="
if ! grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
  echo "Warning: this script is written for Ubuntu 24.04 LTS. Continuing anyway in 5s (Ctrl+C to stop)..."
  sleep 5
fi

echo "== Installing Coolify (this also installs Docker if not already present) =="
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

echo ""
echo "== Done =="
echo "Coolify is installed. Next steps:"
echo "  1. Open http://<this-server-ip>:8000 and create your admin account NOW —"
echo "     that port is open to the world until you do."
echo "  2. Point a subdomain (e.g. hosting.altegic.co.za) at this server's IP,"
echo "     then set that domain in Coolify's own settings so the dashboard gets"
echo "     real HTTPS and you can close off direct :8000 access afterward."
echo "  3. Connect your GitHub/GitLab account under Sources, then deploy your"
echo "     first application via New Resource -> Application."
echo ""
echo "Full walkthrough: self-hosted-setup-guide.md, Part 2."
