#!/bin/sh
# Container entrypoint:
#   1. write a clamd.conf (loopback TCP only - never expose the AV daemon)
#   2. refresh signatures (fast incremental update; the DB was fetched at build)
#   3. start clamd as the unprivileged `clamav` user and wait until it is ready
#   4. start the node scan API
set -e

DB_DIR="${DB_DIR:-/var/lib/clamav}"
CLAMD_HOST="${CLAMD_HOST:-127.0.0.1}"
CLAMD_PORT="${CLAMD_PORT:-3310}"

cat > "$CLAMD_CONF" <<EOF
LogFile /tmp/clamd.log
LogTime yes
LogRotate yes
DatabaseDirectory $DB_DIR
LocalSocket /run/clamav/clamd.sock
TCPSocket $CLAMD_PORT
TCPAddr $CLAMD_HOST
MaxThreads 8
StreamMaxLength 256M
MaxScanSize 256M
MaxFileSize 256M
Foreground yes
EOF

echo "[entrypoint] refreshing virus signatures (freshclam)"
# The build already fetched the database, so this is normally a quick diff.
gosu clamav freshclam --config-file=/etc/clamav/freshclam.conf --datadir="$DB_DIR" \
  || echo "[entrypoint] freshclam update failed - continuing with the built-in database"

echo "[entrypoint] starting clamd"
gosu clamav clamd --config-file="$CLAMD_CONF" &

# Wait for the daemon. node is always present, so no need for netcat.
CLAMD_HOST="$CLAMD_HOST" CLAMD_PORT="$CLAMD_PORT" node /app/wait-for-clamd.js

echo "[entrypoint] clamd is ready"
exec gosu clamav node server.js
