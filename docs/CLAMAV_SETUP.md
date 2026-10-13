# ClamAV Virus Scanner for Learning Materials

Ang folder na ito ay ang buong ClamAV setup para sa **learning materials ng
mentors**. Dito lang ito aktibo — hindi ginagamit sa ibang upload flows
(messages, profile pictures, at iba pa).

Layunin: kapag nag-upload ng PDF/video/document si mentor, i-scan muna ito ng
ClamAV **bago** ma-publish sa public storage. Kapag may virus → hindi
na-publish. Ang alert ay generic lang - hindi ipinapakita kung anong signature ang
natugma, para hindi mailang ng uploader kung paano ito lalabanin.

---

## What the three hosts do

```
Vercel (Angular app)  ----->  Supabase Edge Function  ----->  ClamAV scanner
  front-end only,              (in Supabase cloud)            (Docker on Railway
  no AV engine                                               /Render/VPS, or your PC)
```

- **Vercel** - static Angular app. There is no server code running there, so
  there is nowhere to put ClamAV. This does not change.
- **Supabase (free plan)** - database, storage, and the `scan-learning-material`
  Edge Function. Your app already talks to it from the browser.
- **Scanner** - a separate always-on service. This is the only new thing to
  deploy, and it needs **2GB+ of RAM** (see Step 2).

Mahalaga: ang nasa Vercel ay HTML/JS/CSS lang. Lahat ng data (upload, rows) ay
pumupunta sa Supabase, kaya walang nahihiwalay sa "hosting".

---

## Storage layout (isang bucket lang)

```
learning-materials/
├── quarantine/<mentor-id>/<file-name>   ← staged, HINDI publicly readable
└── <mentor-id>/<file-name>              ← published, publicly readable
```

Ang RLS policies sa `supabase/clamav-storage-setup.sql` ang pumipigil sa public
na mabasa ang `quarantine/` prefix.

Bakit isang bucket at hindi dalawang? Dahil kapag malinis na ang file,
ini-*rename* lang ito ng Edge Function (`move()`) — server-side, walang
ina-upload na bytes. Ito ang dahilan kung bakit ito gumagana sa Supabase
**free plan**, kung saan ang Edge Function ay may 256MB memory at 2s CPU
lang kada tawag. Ang lumang disenyo (download → buffer → re-upload) ay
puwedeng mag-OOM sa malalaking file.

---

## Step 1 — SQL (Supabase Dashboard → SQL Editor)

I-run ang `supabase/clamav-storage-setup.sql` (isa lang, isang beses).

I-verify:

```sql
select id, public from storage.buckets where id = 'learning-materials';
select policyname from pg_policies where tablename = 'objects' order by policyname;
```

Dapat `public = true` ang bucket, at may policies na nagsasabing:
`storage.foldername(name)[1] <> 'quarantine'` para sa public read.

---

## Step 2 - Deploy the scanner

The scanner needs its own always-on host. It **cannot run on Vercel**, and
this is a hard technical limit, not a preference:

| ClamAV needs | Vercel gives |
|---|---|
| a persistent daemon (`clamd`) | none - every request gets a fresh container |
| signatures updated on disk | read-only filesystem (except `/tmp`) |
| ~108MB virus database | 250MB bundle cap per function |
| **980MB RAM** (measured) | 1GB (Hobby) / 3GB (Pro) |

Measured on the local daemon with a full signature database:

```
clamd pid 944: private 980MB
database: main.cvd 84.9MB + daily.cvd 22.4MB + bytecode.cvd 0.3MB
```

So a 512MB plan is not enough - clamd gets OOM-killed. **Use 2GB or more.**
The container honours the platform `PORT` and exposes `/health`, so it runs
unchanged on any of the hosts below.

### Free options

**Option A - Google Cloud Run (free, recommended for a student project)**

Free tier: 2M requests/month, 360,000 GiB-seconds of memory. At 2Gi that is
roughly **50 hours of runtime per month**, and it scales to zero when idle, so
unused time costs nothing.

```bash
gcloud run deploy lcg-virus-scanner \
  --source scanner \
  --region asia-southeast1 \
  --memory 2Gi \
  --timeout 300s \
  --set-env-vars "SCAN_API_KEY=<your key>,CLAMD_HOST=127.0.0.1,CLAMD_PORT=3310"
```

Why 2Gi and not 1Gi: clamd alone measures 980MB, and node/express adds
roughly another 60-80MB, so 1Gi (1024MB) leaves no headroom and the container
would be killed on a large scan. 2Gi is safe. At 2Gi the 360,000 free
GiB-seconds still come to about 50 hours of runtime per month.

Trade-off: Cloud Run scales to zero, so the first scan after an idle period
pays a cold start while clamd loads ~108MB of signatures (~30-60s). The
Edge Function timeout (120s) already tolerates this. Add `--min-instances 1`
only if you move to a paid tier.

**Option B - your own PC (free, working today)**

```powershell
.\scripts\setup-clamav.ps1 -StartDaemon
cd scanner
Copy-Item .env.example .env
notepad .env          # set SCAN_API_KEY
npm install
npm start
npm run scanner:tunnel    # cloudflared - prints a public https URL
```

Use the printed URL as `CLAMAV_SCAN_URL`. The PC must stay on, and the
tunnel URL changes on each restart, so the Supabase secret must be updated.
This is the fastest way to test the whole flow right now.

**Option C - Oracle Cloud Always Free (free, permanent)**

Now 2 OCPU / 12GB RAM for free-tier accounts (Oracle cut this from
4 OCPU / 24GB in June 2026). Plenty for clamd, but you manage the VM
yourself: create an Ampere A1 instance, open the port, then install and run
the scanner exactly like on your PC. Needs a card for signup.

### Paid option (easiest, cheapest that always stays warm)

**Railway (~$5/mo)** - `railway.json` is in the repo, so Railway detects the
scanner automatically. ~8GB RAM, about $5/mo.

1. Railway Dashboard -> **New Project** -> **Deploy from GitHub repo**
2. Railway finds `railway.json` and builds `scanner/Dockerfile`
3. **Variables** -> add `SCAN_API_KEY` (a long random string)
4. **Settings -> Networking -> Generate Domain**
5. Use that URL as `CLAMAV_SCAN_URL`

**Render** - `render.yaml` is in the repo and uses the `standard` 2GB plan
(512MB plans are OOM-killed). About $25/mo.

Whichever you pick, the scanner must be reachable over HTTPS from the
Supabase Edge Function.

---

## Step 3 — Supabase secrets

Dashboard → **Edge Functions → `scan-learning-material` → Secrets**

| Secret | Halaga |
|---|---|
| `CLAMAV_SCAN_URL` | `https://lcg-virus-scanner.onrender.com` (o tunnel URL) |
| `CLAMAV_SCAN_KEY` | parehong `SCAN_API_KEY` ng scanner |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` (kung wala pa) |

---

## Step 4 — I-deploy ang Edge Function

```bash
supabase functions deploy scan-learning-material --project-ref wblacddvxokokjcwnnrm
```

`auth: 'user'` ang ginagamit, kaya hindi kailangang i-disable ang `verify_jwt`.

---

## Ano ang nakikita ng mentor

| Hakbang | UI |
|---|---|
| 1 | "Uploading file securely..." |
| 2 | "Scanning for viruses with ClamAV..." |
| 3a | ✅ "Material uploaded and virus-scanned successfully!" |
| 3b | 🛡️ "Malicious file detected. The upload was rejected and the file was removed." |
| 3c | ❌ "Virus scanner unavailable, please try again later" |

---

## Testing

1. `curl http://<scanner-host>/health` → dapat `{"status":"ok"}`
2. Infected file (EICAR, hindi isinusulat sa disk — binubura ito ni Defender):

```powershell
"X5O!P%@AP[4\PZX54(P^)7CC)7}`$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!`$H+H*" |
  Set-Content eicar.txt -Encoding ascii
curl.exe -X POST http://localhost:3030/scan `
  -H "x-scan-key: <SCAN_API_KEY>" `
  --data-binary "@eicar.txt"
```

Dapat: `"clean":false` — ang signature ay nasa scanner/function logs LAMANG, hindi sa UI.

3. Sa UI: mag-upload ng infected file → dapat may alert na "Malicious file detected",
   walang bagong row sa materials list, at walang signature na ipinapakita.

---

## Free-tier limits na inaccommodate ng design

| Limit | Paano hinawakan |
|---|---|
| 256MB memory / 2s CPU | Walang buffering; streaming + `move()` rename |
| 150s wall clock | Ang scan ay external; ang function ay I/O-bound lang |
| 1GB storage | Walang duplicate copy kapag clean |
| 500K function calls/buwan | Sapat para sa capstone |

## Ops notes

- **Signatures**: `freshclam` hourly (script/Docker nagre-register na). Kung
  luma ang DB, hindi effective ang scan — check `freshclam.log`.
- **clamd down / timeout** → 503, ubos na upload. Safe default: walang virus
  verdict, walang publish.
- **Privacy**: ang file ay dumadaan sa clamd sa scanner host. Sundin ang
  Terms ng ClamAV/Supabase Storage.
