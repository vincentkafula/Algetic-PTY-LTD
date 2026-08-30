#!/bin/sh
set -e

: "${RTPENGINE_PUBLIC_IP:?RTPENGINE_PUBLIC_IP must be set in .env}"
: "${RTP_PORT_MIN:?RTP_PORT_MIN must be set in .env}"
: "${RTP_PORT_MAX:?RTP_PORT_MAX must be set in .env}"

sed \
  -e "s/__RTPENGINE_PUBLIC_IP__/${RTPENGINE_PUBLIC_IP}/g" \
  -e "s/__RTP_PORT_MIN__/${RTP_PORT_MIN}/g" \
  -e "s/__RTP_PORT_MAX__/${RTP_PORT_MAX}/g" \
  /etc/rtpengine/rtpengine.conf.template > /etc/rtpengine/rtpengine.conf

exec rtpengine --config-file=/etc/rtpengine/rtpengine.conf
