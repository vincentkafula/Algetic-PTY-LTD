#!/bin/sh
set -e

# Renders kamailio.cfg from the template using plain sed — deliberately NOT
# envsubst. envsubst substitutes every $VARNAME-shaped token it finds, and
# Kamailio's own config language uses that exact syntax everywhere ($fd,
# $si, $avp(rcv), etc.) — envsubst silently wipes all of those out too.
# This was caught by actually running the rendered config, not by
# inspection; sed with distinct __TOKEN__ placeholders avoids the
# collision entirely.

: "${SIP_PUBLIC_IP:?SIP_PUBLIC_IP must be set in .env}"
: "${SIP_DOMAIN:?SIP_DOMAIN must be set in .env}"

sed \
  -e "s/__SIP_PUBLIC_IP__/${SIP_PUBLIC_IP}/g" \
  -e "s/__SIP_DOMAIN__/${SIP_DOMAIN}/g" \
  /etc/kamailio/kamailio.cfg.template > /etc/kamailio/kamailio.cfg

# Create the SQLite database from Kamailio's own schema files on first run
# only — never overwrite an existing database with subscribers in it.
DB_PATH="/etc/kamailio/kamailio.db"
if [ ! -f "$DB_PATH" ]; then
  echo "No existing database found at $DB_PATH — creating one from Kamailio's schema files."
  for schema in standard-create.sql auth_db-create.sql usrloc-create.sql; do
    sqlite3 "$DB_PATH" < "/usr/share/kamailio/db_sqlite/${schema}"
  done
  echo "Database created. Add your first subscriber with scripts/add-user.sh."
fi

exec kamailio -f /etc/kamailio/kamailio.cfg -DD -E
