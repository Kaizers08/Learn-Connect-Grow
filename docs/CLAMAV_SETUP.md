# ClamAV Virus Scanner for Learning Materials

Ang folder na ito ay ang buong ClamAV setup para sa **learning materials ng
mentors**. Dito lang ito aktibo — hindi ginagamit sa ibang upload flows
(messages, profile pictures, at iba pa).

Layunin: kapag nag-upload ng PDF/video/document si mentor, i-scan muna ito ng
ClamAV **bago** ma-publish sa public storage. Kapag may virus → hindi
na-publish. Ang alert ay generic lang - hindi ipinapakita kung anong signature ang
natugma, para hindi mailang ng uploader kung paano ito lalabanin.

---

## Ano ang nangyayari sa 3 hosting

```
Vercel (Angular app)  ──────►  Supabase Edge Function  ──────►  ClamAV scanner
  front-end lang,              (nasa Supabase cloud)            (Docker sa Render
  walang AV engine                                          /Railway/VPS, o PC mo)
```

- **Vercel** — static Angular app. Walang server code na tumatakbo doon, kaya
  walang ClamAV na puwedeng ilagay. Hindi na ito binabago.
- **Supabase (free plan)** — database, storage, at ang `scan-learning-material`
  Edge Function. Ang app mo ay kausap na nito mula sa browser, gayun pa man.
- **Scanner** — bagong hiwalay na service. Ito lang ang bagong ide-deploy.

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

## Step 2 — I-deploy ang scanner

### Opsyon A: Render.com (recommended, may free tier)

Ang repo ay may `render.yaml` na. Steps:

1. I-push ang repo sa GitHub
2. Render Dashboard → **New → Blueprint** → piliin ang repo
3. Awtomatiko itong gagawa ng `lcg-virus-scanner` service (Docker)
4. Set ang `SCAN_API_KEY` sa Render dashboard → **Manual deploy**
5. Kopyahin ang URL (hal. `https://lcg-virus-scanner.onrender.com`)

> Sa free tier, nag-i-*spin down* ang Render kapag walang request ng ~15 min.
> Ang unang scan pagkatapos ay puwedeng tumagal ng 30–60s. Kung kailangan mo
> ng palaging mabilis, `plan: starter` ($7/buwan) na nasa `render.yaml`.

### Opsyon B: Railway / Fly.io

Pareho ang idea: i-deploy ang `scanner/` ( may `Dockerfile` at
`docker-compose.yml`) at i-expose ang port 3030.

### Opsyon C: Sariling PC (libre, pero kailangang bukas ang PC)

```powershell
.\scripts\setup-clamav.ps1 -StartDaemon
cd scanner
Copy-Item .env.example .env
notepad .env          # ilagay ang SCAN_API_KEY
npm install
npm start
```

Kung local pa ang PC mo, kailangan ng tunnel para maabot ng Supabase:

```powershell
# Cloudflare Tunnel (libre)
cloudflared tunnel --url http://localhost:3030
```

Gamitin ang `https://...trycloudflare.com` URL na ibibigay nito bilang
`CLAMAV_SCAN_URL`.

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
