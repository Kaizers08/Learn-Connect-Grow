#!/usr/bin/env node
/**
 * verify-scan-chain.cjs
 *
 * End-to-end check of the learning-materials virus-scan chain against the REAL
 * Supabase project and the REAL local scanner. It performs exactly what the
 * `scan-learning-material` Edge Function does, without deploying anything:
 *
 *   1. stage a file at  learning-materials/quarantine/<uid>/<name>
 *   2. create a short-lived signed URL for it
 *   3. POST { url } to the scanner (same call the function makes)
 *   4. read the verdict
 *   5. clean     -> rename the object to <uid>/<name>   (what the function does)
 *      infected  -> remove the staged object
 *   6. confirm the quarantine prefix is NOT publicly readable
 *
 * The detected signature is never printed: only operators may see it.
 *
 * Usage (from the repo root):
 *   node scripts/verify-scan-chain.cjs
 *   npm run verify:scan
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  // strip a BOM so the first line still parses
  for (const line of fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const ENV = readEnv(path.join(ROOT, '.env'));
const URL = ENV.SUPABASE_URL;
const SECRET = ENV.SUPABASE_SECRET_KEY;
const BUCKET = ENV.MATERIALS_BUCKET || 'learning-materials';
const SCANNER = process.env.SCANNER_URL || 'http://127.0.0.1:3030';

const SCAN_KEY = readEnv(path.join(ROOT, 'scanner', '.env')).SCAN_API_KEY;

if (!URL || !SECRET) {
  console.error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY in .env');
  process.exit(2);
}
if (!SCAN_KEY) {
  console.error('Missing SCAN_API_KEY in scanner/.env');
  process.exit(2);
}


const UID = '00000000-0000-0000-0000-0000000000ff';

const results = [];
const check = (name, ok, extra = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' -> ' + extra : ''}`);
};

async function api(method, endpoint, body, opts = {}) {
  const headers = { apikey: SECRET, Authorization: `Bearer ${SECRET}` };
  if (!opts.raw) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${URL}${endpoint}`, {
    method,
    headers,
    body: opts.raw ? body : body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

const CLEAN_PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(50), 'latin1');
// EICAR, only ever held in memory.
const EICAR = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*', 'latin1');

async function stage(name, bytes) {
  const key = `quarantine/${UID}/${name}`;
  const r = await api('POST', `/storage/v1/object/${BUCKET}/${key}`, bytes, { raw: true });
  if (r.status >= 400) throw new Error(`stage failed ${r.status}: ${JSON.stringify(r.body)}`);
  return key;
}

async function signedUrl(key) {
  const r = await api('POST', `/storage/v1/object/sign/${BUCKET}/${key}`, { expiresIn: 300 });
  if (r.status >= 400) throw new Error(`sign failed ${r.status}: ${JSON.stringify(r.body)}`);
  return `${URL}/storage/v1${r.body.signedURL}`;
}

async function scanViaScanner(url) {
  const res = await fetch(`${SCANNER}/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-scan-key': SCAN_KEY },
    body: JSON.stringify({ url })
  });
  return { status: res.status, body: await res.json() };
}

(async () => {
  console.log('Verifying the scan chain against the real Supabase project');
  console.log(`  storage : ${URL}  bucket=${BUCKET}`);
  console.log(`  scanner : ${SCANNER}\n`);

  // ── 1. Clean file: stage -> sign -> scan -> publish ────────────────────────
  const cleanKey = await stage('verify-clean.pdf', CLEAN_PDF);
  const cleanScan = await scanViaScanner(await signedUrl(cleanKey));
  check('clean file is scanned through its signed URL', cleanScan.body.clean === true, `status=${cleanScan.status}`);

  const publishedKey = `${UID}/verify-clean.pdf`;
  const move = await api('POST', '/storage/v1/object/move', {
    bucketId: BUCKET, sourceKey: cleanKey, destinationKey: publishedKey
  });
  check('clean file is renamed to its published path', move.status < 400, `status=${move.status}`);

  // ── 2. Infected file: stage -> sign -> scan -> rejected ────────────────────
  const badKey = await stage('verify-infected.bin', EICAR);
  const badScan = await scanViaScanner(await signedUrl(badKey));
  check('infected file is detected', badScan.body.clean === false, `status=${badScan.status}`);

  const removeBad = await api('DELETE', `/storage/v1/object/${BUCKET}`, { prefixes: [badKey] });
  check('infected file is deleted from quarantine', removeBad.status < 400, `status=${removeBad.status}`);

  // ── 3. Quarantine must not be publicly readable ────────────────────────────
  const probeKey = await stage('verify-probe.bin', Buffer.from('%PDF-1.4 probe'));
  const anonSign = await fetch(`${URL}/storage/v1/object/sign/${BUCKET}/${probeKey}`, {
    method: 'POST',
    headers: { apikey: ENV.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 60 })
  });
  // An anon caller must NOT be able to mint a signed URL for a staged file.
  check('quarantine is not readable by the public anon key', !(anonSign.ok), `status=${anonSign.status}`);

  // ── 4. Cleanup ─────────────────────────────────────────────────────────────
  await api('DELETE', `/storage/v1/object/${BUCKET}`, { prefixes: [publishedKey, cleanKey, badKey, probeKey] });

  results.forEach((r) => console.log(r));
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(failed === 0
    ? '\nCHAIN VERIFIED against the real project'
    : `\n${failed} CHECK(S) FAILED`);
  console.log('\nNote: a clean verdict requires scanner/.env SCAN_API_KEY and the');
  console.log('ClamAV policies from supabase/clamav-storage-setup.sql to be applied.');
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error('HARNESS ERROR:', e.message);
  process.exit(2);
});
