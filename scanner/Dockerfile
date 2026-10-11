# Learning-materials virus scanner: node API + clamd in one container.
#
# The virus database is downloaded at BUILD time (RUN freshclam) so a container
# start is fast, then refreshed incrementally at runtime.
FROM node:20-slim

ENV DEBIAN_FRONTEND=noninteractive \
    CLAMD_CONF=/etc/clamav/clamd.conf \
    DB_DIR=/var/lib/clamav

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       clamav-daemon \
       clamav-freshclam \
       ca-certificates \
       curl \
       iproute2 \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p "$DB_DIR" /run/clamav \
    && chown -R clamav:clamav "$DB_DIR" /run/clamav

# ── Download the signature database at build time (cache bustable) ────────────
ARG CACHEBUST=1
RUN freshclam --config-file=/etc/clamav/freshclam.conf \
      --datadir="$DB_DIR" || \
    echo "freshclam build step failed, will retry at runtime"

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js ./

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3030
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
