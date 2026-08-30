#!/bin/sh
# Usage: ./scripts/add-user.sh <username> <password>
# Run from the sip-network/ directory.
set -e
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <username> <password>" >&2
  exit 1
fi
docker compose exec kamailio python3 /usr/local/bin/manage_subscribers.py add "$1" "$2"
