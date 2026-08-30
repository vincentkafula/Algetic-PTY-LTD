#!/bin/sh
# Usage: ./scripts/remove-user.sh <username>
# Run from the sip-network/ directory.
set -e
if [ -z "$1" ]; then
  echo "Usage: $0 <username>" >&2
  exit 1
fi
docker compose exec kamailio python3 /usr/local/bin/manage_subscribers.py remove "$1"
