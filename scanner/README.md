# Learning Materials Virus Scanner (ClamAV)

Maliit na HTTP service na naka-wrap sa lokal na **clamd** (ClamAV daemon).
Ginagamit ito ng Supabase Edge Function `scan-learning-material` para i-scan
ang mga ina-upload na learning materials ng mentors **bago** ito ma-publish sa
public bucket.

> Bakit hindi diretsong clamd ang tinatawag ng Edge Function? Supabase Edge
> Functions run on Deno Deploy â€” hindi nito ma-load ang native ClamAV engine.
> Kaya may thin wrapper service na ito na naka-konekta sa clamd sa parehong
> machine (o sa parehong Docker network).

---

## 1. What runs where

```
Mentor browser â”€â”€â–¶ Angular app
                     â”‚  1. upload file (private quarantine/ path)
                     â–¼
               Supabase Storage (learning-materials bucket, quarantine/ prefix — private)
                     â”‚  2. POST /functions/v1/scan-learning-material { path }
                     â–¼
               Supabase Edge Function â”€â”€â–¶ POST http://<host>:3030/scan
                                                (x-scan-key: <SCAN_API_KEY>)
                     â”‚                              â”‚  raw bytes
                     â”‚  3. verdict                  â–¼
                     â—€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ clamd (TCP 3310)
                     â”‚  4a. clean  â†’ move file to public bucket
                     â”‚  4b. infected â†’ delete file, tell mentor
                     â–¼
               learning_materials row (only when clean)
```

## 2. Endpoints

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `POST` | `/scan` | `x-scan-key: <SCAN_API_KEY>` | `{"url":"<signed url>"}` (JSON) **or** raw file bytes | `{ clean, virus, tookMs, scannedAt }` |
| `GET` | `/health` | none | - | `{ status, engine, clamd }` |
| `GET` | `/` | none | - | service banner |

Two scan modes, same verdict:

- **JSON `{ url }` (what the Edge Function sends)** - the scanner streams the
  file from that URL straight into clamd, so the file is never buffered here.
- **Raw bytes (curl / manual testing)** - the file body is posted directly and
  still chunked into clamd's `nINSTREAM` framing.

Any failure (clamd down, timeout, bad key, oversized file, unreachable url)
means **not verified clean** - the Edge Function then refuses to publish.


## 3. Run locally (Windows)

Prereqs: ClamAV installed and `clamd` running (see `scripts/setup-clamav.ps1`
and `docs/CLAMAV_SETUP.md`).

```powershell
cd scanner
Copy-Item .env.example .env
notepad .env          # set SCAN_API_KEY (same value you put in Supabase secrets)
npm install
npm start
```

Quick test (expect `clean: true` on health, `clean: false` + virus on EICAR):

```powershell
curl.exe http://localhost:3030/health

# EICAR in-memory: the file is piped straight from the request body, so
# Windows Defender never sees it on disk (it deletes any EICAR file it finds).
# Any 68-byte payload works; a real PDF works too.
"%PDF-1.4 harmless" | Out-File -Encoding ascii dummy.pdf

curl.exe -X POST http://localhost:3030/scan `
  -H "x-scan-key: <your SCAN_API_KEY>" `
  -H "content-type: application/octet-stream" `
  --data-binary "@dummy.pdf"

# The scanner can also pull the file itself, which is what Supabase does:
curl.exe -X POST http://localhost:3030/scan `
  -H "x-scan-key: <your SCAN_API_KEY>" `
  -H "content-type: application/json" `
  -d '{\"url\":\"https://example.com/some-file.pdf\"}'
```

## 4. Run with Docker (clamav + service in one container)

```bash
cd scanner
docker compose up --build -d
curl http://localhost:3030/health
```

The image installs `clamav-daemon`, runs `freshclam` for the first database
download, waits until clamd answers `PING`, then starts the API.

## 5. Production options

| Option | Notes |
|---|---|
| Same machine as your backend | simplest for local/small deployments. Bind `CLAMD_HOST=127.0.0.1`, never expose port 3030 or 3310 to the internet. |
| Small VPS / Fly.io / Railway / Render | run `docker compose` there and set `CLAMAV_SCAN_URL` (edge function secret) to that public URL. |
| Always-on LAN host | set `CLAMD_HOST` to the host running clamd. |

Keep the virus database fresh â€” `freshclam` at least hourly (the Docker image
and the Windows setup script both register that already).

## 6. Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3030` | HTTP port of this service |
| `SCAN_API_KEY` | â€” | shared secret; required, otherwise `/scan` is disabled (fail-closed) |
| `CLAMD_HOST` | `127.0.0.1` | clamd host |
| `CLAMD_PORT` | `3310` | clamd TCP port |
| `MAX_SCAN_BYTES` | `67108864` | max accepted upload size in bytes |
| `CLAMD_TIMEOUT_MS` | `120000` | per-file scan timeout |
| `ALLOWED_ORIGIN` | â€” | optional CORS origin for browser testing |

