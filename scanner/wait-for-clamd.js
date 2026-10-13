/**
 * wait-for-clamd.js
 *
 * Blocks until the local clamd daemon answers a PING (or gives up after 5
 * minutes). Used by the Docker entrypoint, which cannot rely on netcat being
 * installed but always has node.
 *
 * Exit codes: 0 = clamd answered PONG, 1 = never became ready.
 */
const net = require('node:net');

const HOST = process.env.CLAMD_HOST || '127.0.0.1';
const PORT = Number(process.env.CLAMD_PORT || 3310);
const DEADLINE_MS = 2 * 60 * 1000;
const ATTEMPT_TIMEOUT_MS = 5000;

function attempt() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: HOST, port: PORT });
    let settled = false;

    const done = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(ok);
    };

    const timer = setTimeout(() => done(false), ATTEMPT_TIMEOUT_MS);

    socket.on('connect', () => socket.write('zPING\x00'));
    socket.on('data', (chunk) => done(chunk.toString('utf8').includes('PONG')));
    socket.on('error', () => done(false));
    socket.on('close', () => done(false));
  });
}

(async () => {
  const deadline = Date.now() + DEADLINE_MS;
  let tries = 0;

  while (Date.now() < deadline) {
    tries++;
    if (await attempt()) {
      console.log(`[wait-for-clamd] clamd on ${HOST}:${PORT} is ready (after ${tries} attempt(s))`);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.error(`[wait-for-clamd] clamd on ${HOST}:${PORT} never became ready`);
  process.exit(1);
})();
