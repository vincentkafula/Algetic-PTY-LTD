#!/usr/bin/env python3
"""
Manages SIP subscribers directly in Kamailio's SQLite database.

Uses the exact HA1/HA1B computation validated during development (see
sip-network/README.md) — plain MD5 of "username:realm:password", which is
what Kamailio's auth_db module expects when calculate_ha1=1 is NOT the only
path relied on; storing precomputed ha1/ha1b directly is what this project
tested against and confirmed working end-to-end with a real REGISTER and
INVITE, so this script writes them the same way rather than relying only on
calculate_ha1 to derive them on the fly.

Usage (run inside the kamailio container, e.g. via
`docker compose exec kamailio python3 /usr/local/bin/manage_subscribers.py ...`):

    manage_subscribers.py add <username> <password>
    manage_subscribers.py remove <username>
    manage_subscribers.py list
"""
import sqlite3
import hashlib
import os
import sys

DB_PATH = "/etc/kamailio/kamailio.db"


def get_domain():
    domain = os.environ.get("SIP_DOMAIN")
    if not domain:
        print("SIP_DOMAIN is not set in the environment — check .env", file=sys.stderr)
        sys.exit(1)
    return domain


def add_user(username, password):
    domain = get_domain()
    ha1 = hashlib.md5(f"{username}:{domain}:{password}".encode()).hexdigest()
    ha1b = hashlib.md5(f"{username}@{domain}:{domain}:{password}".encode()).hexdigest()

    conn = sqlite3.connect(DB_PATH)
    existing = conn.execute(
        "SELECT id FROM subscriber WHERE username = ? AND domain = ?", (username, domain)
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE subscriber SET password = ?, ha1 = ?, ha1b = ? WHERE id = ?",
            (password, ha1, ha1b, existing[0]),
        )
        print(f"Updated password for {username}@{domain}")
    else:
        conn.execute(
            "INSERT INTO subscriber (username, domain, password, ha1, ha1b) VALUES (?,?,?,?,?)",
            (username, domain, password, ha1, ha1b),
        )
        print(f"Added subscriber {username}@{domain}")
    conn.commit()
    conn.close()


def remove_user(username):
    domain = get_domain()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute("DELETE FROM subscriber WHERE username = ? AND domain = ?", (username, domain))
    conn.commit()
    conn.close()
    if cur.rowcount:
        print(f"Removed {username}@{domain}")
    else:
        print(f"No subscriber found for {username}@{domain}")


def list_users():
    domain = get_domain()
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT username FROM subscriber WHERE domain = ? ORDER BY username", (domain,)).fetchall()
    conn.close()
    if not rows:
        print(f"No subscribers on {domain} yet.")
        return
    for (username,) in rows:
        print(f"{username}@{domain}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "add":
        if len(sys.argv) != 4:
            print("Usage: manage_subscribers.py add <username> <password>", file=sys.stderr)
            sys.exit(1)
        add_user(sys.argv[2], sys.argv[3])
    elif cmd == "remove":
        if len(sys.argv) != 3:
            print("Usage: manage_subscribers.py remove <username>", file=sys.stderr)
            sys.exit(1)
        remove_user(sys.argv[2])
    elif cmd == "list":
        list_users()
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
