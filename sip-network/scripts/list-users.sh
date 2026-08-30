#!/bin/sh
# Usage: ./scripts/list-users.sh
# Run from the sip-network/ directory.
set -e
docker compose exec kamailio python3 /usr/local/bin/manage_subscribers.py list
