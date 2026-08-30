FROM ubuntu:24.04
# Same base as the Kamailio image for consistency. NOTE: this image could
# not be built and run in this project's development sandbox — a broken
# package mirror blocked one of rtpengine-daemon's dependencies
# (libmysqlclient21). The Dockerfile itself is a standard, well-documented
# pattern, but test the actual build on your VPS before relying on it —
# see sip-network/README.md.

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends rtpengine-daemon && \
    rm -rf /var/lib/apt/lists/*

COPY rtpengine.conf.template /etc/rtpengine/rtpengine.conf.template
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
