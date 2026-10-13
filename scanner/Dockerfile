# Learning-materials virus scanner: node API + clamd in one container.
#
# The virus database is downloaded at BUILD time (as the unprivileged `clamav`
# user, so the files stay writable for runtime updates) so a container start is
# fast, then refreshed incrementally at runtime.
FROM node:20-slim

ENV DEBIAN_FRONTEND=noninteractive \
    CLAMD_CONF=/etc/clamav/clamd.conf \
    DB_DIR=/var/lib/clamav

# gosu lets us drop to the `clamav` user; the clamav packages create that user.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       clamav-daemon \
       clamav-freshclam \
       gosu \
       ca-certificates \
       curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p "$DB_DIR" /run/clamav \
    && chown -R clamav:clamav "$DB_DIR" /run/clamav

# ── Download the signature database at build time ────────────────────────────
# Run as `clamav` (not root) so the downloaded files are owned by the same user
# that will update them at runtime; otherwise freshclam cannot write to them.
ARG CACHEBUST=1
RUN gosu clamav freshclam --config-file=/etc/clamav/freshclam.conf \
      --datadir="$DB_DIR" || \
    echo "freshclam build step failed, will retry at runtime"

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js wait-for-clamd.js ./

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3030
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
