FROM ubuntu:24.04
# Matches the exact distro/package combination (Ubuntu 24.04 "noble",
# Kamailio 5.7.4) that this project's config was actually installed and
# tested against — see kamailio.cfg.template's header comment.

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      kamailio kamailio-sqlite-modules sqlite3 python3 && \
    rm -rf /var/lib/apt/lists/*

COPY kamailio.cfg.template /etc/kamailio/kamailio.cfg.template
COPY manage_subscribers.py /usr/local/bin/manage_subscribers.py
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# SIP signaling: 5060/udp+tcp. Media (RTP) is handled by the separate
# rtpengine container/service, not this one.
EXPOSE 5060/udp 5060/tcp

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
