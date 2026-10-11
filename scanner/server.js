/**
 * clamd INSTREAM command prefix.
 *
 * clamd requires a `z` (deflated) or `n` (uncompressed) prefix on every
 * session command that transfers data â€” a plain `INSTREAM` is rejected with
 * "UNKNOWN COMMAND". We use `n` so no zlib step is needed on either side.
 *
 * Chunk framing (big-endian length, then bytes):
 *   nINSTREAM\n <len><data> <len><data> ... <0000> â†’ "stream: OK" | FOUND
 */
const INSTREAM_COMMAND = 'nINSTREAM\n'

require('dotenv').config();

const crypto = require('node:crypto');
const express = require('express');
const net = require('node:net');

// â”€â”€ Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CONFIG = {
  port: Number(process.env.PORT || 3030),
  scanApiKey: (process.env.SCAN_API_KEY || '').trim(),
  clamdHost: process.env.CLAMD_HOST || '127.0.0.1',
  clamdPort: Number(process.env.CLAMD_PORT || 3310),
  maxScanBytes: Number(process.env.MAX_SCAN_BYTES || 64 * 1024 * 1024), // 64MB
  clamdTimeoutMs: Number(process.env.CLAMD_TIMEOUT_MS || 120000),
  allowedOrigin: (process.env.ALLOWED_ORIGIN || '').trim()
};

if (!CONFIG.scanApiKey) {
  console.warn(
    '[scanner] SCAN_API_KEY is not set â€” /scan will refuse every request (fail-closed).'
  );
}

const app = express();
app.disable('x-powered-by');

// â”€â”€ Body parsing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Everything arrives as raw bytes; the route decides how to interpret it:
//   - content-type application/json â†’ parsed as JSON ({ "url": ... })
//   - anything else                  â†’ the raw file bytes, forwarded to clamd
app.use(express.raw({ type: () => true, limit: CONFIG.maxScanBytes }));

function corsHeaders() {
  const headers = {};
  if (CONFIG.allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = CONFIG.allowedOrigin;
    headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'content-type, x-scan-key';
  }
  return headers;
}

function isScanKeyValid(supplied) {
  if (!CONFIG.scanApiKey || !supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(CONFIG.scanApiKey);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Runs a single-line clamd command (PING, VERSION).
 * Resolves as soon as clamd sends a reply line â€” the connection is then closed.
 */
function clamdLineCommand(command) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: CONFIG.clamdHost, port: CONFIG.clamdPort });
    let reply = '';

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('clamd timeout'));
    }, CONFIG.clamdTimeoutMs);

    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`clamd connection failed (${CONFIG.clamdHost}:${CONFIG.clamdPort}) â€” ${err.message}`));
    });

    // z-prefixed commands are null-terminated and the reply may carry a
    // trailing NUL, so strip those before resolving.
    const normalize = (value) => value.replace(/\x00/g, '').trim();

    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`clamd connection failed (${CONFIG.clamdHost}:${CONFIG.clamdPort}) - ${err.message}`));
    });

    socket.on('data', (chunk) => {
      reply += chunk.toString('utf8');
      const line = normalize(reply);
      // A z command is answered with a NUL terminator; a bare command with a newline.
      if (line.startsWith('PONG') || line.startsWith('ClamAV') || reply.includes('\n')) {
        clearTimeout(timer);
        socket.destroy();
        resolve(line);
      }
    });

    socket.on('close', () => {
      clearTimeout(timer);
      if (normalize(reply)) resolve(normalize(reply));
      else reject(new Error(`clamd closed without a reply (${CONFIG.clamdHost}:${CONFIG.clamdPort})`));
    });

socket.write(`z${command}\0`);
  });
}

/** Scans a Buffer through clamd INSTREAM and resolves { clean, virus, raw }. */
function clamdScan(buffer) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: CONFIG.clamdHost, port: CONFIG.clamdPort });
    let reply = '';
    let settled = false;
    const startedAt = Date.now();

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      fn(value);
    };

    const timer = setTimeout(() => {
      finish(reject, new Error('clamd scan timeout'));
    }, CONFIG.clamdTimeoutMs);

    socket.on('error', (err) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(new Error(`clamd connection failed (${CONFIG.clamdHost}:${CONFIG.clamdPort}) â€” ${err.message}`));
    });

    socket.on('data', (chunk) => {
      reply += chunk.toString('latin1');

      // clamd terminates every reply line with a newline, as soon as the
      // "stream: ..." verdict line is complete we have the result.
      if (!reply.includes('\n')) return;

      const line = reply
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('stream:')) || reply.trim();

      if (/^stream:\s*OK(\s|$)/i.test(line)) {
        finish(resolve, { clean: true, virus: null, tookMs: Date.now() - startedAt, raw: line });
        return;
      }

      const found = line.match(/^stream:\s*(.+?)\s+FOUND/i);
      if (found) {
        finish(resolve, {
          clean: false,
          virus: found[1].trim(),
          tookMs: Date.now() - startedAt,
          raw: line
        });
        return;
      }

      if (/^stream:\s*(error|cannot|limit|unauthorized)/i.test(line)) {
        finish(reject, new Error(`clamd reported: ${line}`));
        return;
      }

      finish(reject, new Error(`Unexpected clamd response: ${reply.trim() || '<empty>'}`));
    });

    socket.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`clamd closed without a verdict (${CONFIG.clamdHost}:${CONFIG.clamdPort})`));
    });

    socket.on('connect', () => {
      socket.write(INSTREAM_COMMAND);
      pipeIntoClamd(socket, buffer);
    });
  });
}

/** Feeds bytes to an already-connected INSTREAM socket, in 32KB chunks. */
function pipeIntoClamd(socket, buffer) {
  const CHUNK = 32 * 1024;
  let offset = 0;

  const writeNext = () => {
    while (offset < buffer.length) {
      const end = Math.min(offset + CHUNK, buffer.length);
      const slice = buffer.subarray(offset, end);
      const header = Buffer.alloc(4);
      header.writeUInt32BE(slice.length, 0);
      offset = end;
      if (!socket.write(header)) {
        socket.once('drain', writeNext);
        return;
      }
      if (!socket.write(slice)) {
        socket.once('drain', writeNext);
        return;
      }
    }
    // zero-length chunk terminates the stream
    const end = Buffer.alloc(4);
    end.writeUInt32BE(0, 0);
    socket.write(end);
  };

  writeNext();
}

/**
 * Streams a remote file straight into clamd without ever holding it in memory.
 * `clamdScan` is driven chunk by chunk over an INSTREAM framing.
 */
function clamdScanStream(readStream) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: CONFIG.clamdHost, port: CONFIG.clamdPort });
    let reply = '';
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      readStream.destroy();
      socket.destroy();
      fn(value);
    };

    const timer = setTimeout(() => {
      finish(reject, new Error('clamd scan timeout'));
    }, CONFIG.clamdTimeoutMs);

    socket.on('error', (err) => {
      finish(reject, new Error(`clamd connection failed (${CONFIG.clamdHost}:${CONFIG.clamdPort}) â€” ${err.message}`));
    });

    socket.on('data', (chunk) => {
      reply += chunk.toString('latin1');
      if (!reply.includes('\n')) return;

      const line = reply
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('stream:')) || reply.trim();

      if (/^stream:\s*OK(\s|$)/i.test(line)) {
        finish(resolve, { clean: true, virus: null, raw: line });
      } else {
        const found = line.match(/^stream:\s*(.+?)\s+FOUND/i);
        if (found) {
          finish(resolve, { clean: false, virus: found[1].trim(), raw: line });
        } else {
          finish(reject, new Error(`Unexpected clamd response: ${reply.trim() || '<empty>'}`));
        }
      }
    });

    socket.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`clamd closed without a verdict (${CONFIG.clamdHost}:${CONFIG.clamdPort})`));
    });

    socket.on('connect', () => {
      socket.write(INSTREAM_COMMAND);

      let queued = false;
      const pump = () => {
        if (queued) return;
        queued = true;
        setImmediate(() => {
          queued = false;
          let chunk;
          while ((chunk = readStream.read(32 * 1024)) !== null) {
            const header = Buffer.alloc(4);
            header.writeUInt32BE(chunk.length, 0);
            socket.write(header);
            if (!socket.write(chunk)) return; // backpressure: resume on drain
          }
          if (!readStream.readableEnded) return;
          const end = Buffer.alloc(4);
          end.writeUInt32BE(0, 0);
          socket.write(end);
        });
      };

      readStream.on('readable', pump);
      readStream.on('end', pump);
      socket.on('drain', pump);
      pump();
    });
  });
}

// â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.options('/scan', (_req, res) => {
  res.writeHead(204, corsHeaders()).end();
});

app.get('/', (_req, res) => {
  res.json({
    service: 'learning-materials-virus-scanner',
    engine: 'ClamAV (clamd)',
    endpoints: {
      'POST /scan': 'raw file bytes + x-scan-key header',
      'GET /health': 'clamd status'
    }
  });
});

/** Reports whether the scanner (and its clamd daemon) is alive. */
app.get('/health', async (_req, res) => {
  try {
    const [ping, version] = await Promise.all([
      clamdLineCommand('PING'),
      clamdLineCommand('VERSION')
    ]);
    res.json({
      status: ping.toUpperCase() === 'PONG' ? 'ok' : 'degraded',
      engine: version,
      clamd: `${CONFIG.clamdHost}:${CONFIG.clamdPort}`
    });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

/**
 * Scans the request body. Two modes:
 *   1. JSON { "url": "<signed download url>" } â€” streams the remote file into
 *      clamd without buffering it here (used by the Supabase Edge Function).
 *   2. Raw file bytes â€” streams a local/temporary copy (curl, local testing).
 *
 * Either way the verdict is binary: anything that is not explicitly clean is a
 * failure, never a pass.
 */
app.post('/scan', async (req, res) => {
  if (!isScanKeyValid(req.get('x-scan-key'))) {
    res.status(401).json({ error: 'Invalid or missing x-scan-key' });
    return;
  }

  const startedAt = Date.now();

  try {
    const contentType = (req.get('content-type') || '').toLowerCase();
    let result;
    let scannedBytes = null;

    if (contentType.includes('application/json')) {
      // â”€â”€ Mode 1: scan a remote URL by streaming it into clamd â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      let payload;
      try {
        payload = JSON.parse(req.body.toString('utf8'));
      } catch {
        res.status(400).json({ error: 'Malformed JSON body' });
        return;
      }

      const url = payload && typeof payload.url === 'string' ? payload.url : '';
      if (!url) {
        res.status(400).json({ error: 'JSON body must contain { "url": "<file url>" }' });
        return;
      }

      let upstream;
      try {
        upstream = await fetch(url, { signal: AbortSignal.timeout(CONFIG.clamdTimeoutMs) });
      } catch (error) {
        // Network-level failure reaching the file URL.
        res.status(502).json({
          error: 'Could not fetch the file url',
          details: error instanceof Error ? error.message : String(error)
        });
        return;
      }

      if (!upstream.ok || !upstream.body) {
        res.status(502).json({ error: `Could not fetch the file url (${upstream.status})` });
        return;
      }

      // Convert the WHATWG ReadableStream into a Node stream we can pace.
      const { Readable } = require('node:stream');
      const nodeStream = Readable.fromWeb(upstream.body);

      result = await clamdScanStream(nodeStream);
    } else {
      // â”€â”€ Mode 2: raw bytes in the request body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const body = Buffer.isBuffer(req.body) ? req.body : null;

      if (!body || body.length === 0) {
        res.status(400).json({ error: 'Empty request body â€” send the raw file bytes' });
        return;
      }
      scannedBytes = body.length;
      result = await clamdScan(body);
    }

    res.json({
      clean: result.clean,
      virus: result.clean ? null : result.virus,
      scannedBytes,
      tookMs: Date.now() - startedAt,
      scannedAt: new Date().toISOString(),
      raw: result.raw
    });
  } catch (err) {
    console.error('[scanner] scan failed:', err.message);
    res.status(503).json({ error: 'Scanner unavailable', details: err.message });
  }
});

// express.raw error handler (e.g. payload too large) must be the last middleware.
app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.too.large') {
    res.status(413).json({ error: `File exceeds the ${CONFIG.maxScanBytes} byte limit` });
    return;
  }
  console.error('[scanner] unexpected error:', err);
  res.status(500).json({ error: 'Internal scanner error' });
});

// â”€â”€ Start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const server = app.listen(CONFIG.port, () => {
  console.log(
    `[scanner] listening on http://0.0.0.0:${CONFIG.port} â€” clamd at ${CONFIG.clamdHost}:${CONFIG.clamdPort} (max ${CONFIG.maxScanBytes} bytes)`
  );
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`[scanner] ${signal} received â€” shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}

