# scripts/start-scanner.ps1
#
# Starts the whole ClamAV scanner stack for mentor learning-material uploads:
#   1. clamd        (if not already running)
#   2. scanner      (node service on port 3030)
#   3. cloudflared  (public HTTPS URL so Supabase can reach the scanner)
#
# Then prints the public URL you must set as CLAMAV_SCAN_URL in the Supabase
# function secrets.
#
# Usage:
#   .\scripts\start-scanner.ps1              # start everything
#   .\scripts\start-scanner.ps1 -SkipTunnel   # local only, no public URL
#   .\scripts\start-scanner.ps1 -TestOnly    # just check the stack is healthy

[CmdletBinding()]
param(
    [switch] $SkipTunnel,
    [switch] $TestOnly,
    [string] $ScannerDir = "scanner",
    [string] $ClamAvDir = "C:\ClamAV"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

function Write-Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok($m) { Write-Host "  OK  $m" -ForegroundColor Green }
function Write-Bad($m) { Write-Host "  FAIL $m" -ForegroundColor Red }

function Test-Port($port) {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

# -- 0. Health check mode ------------------------------------------------------
if ($TestOnly) {
    Write-Step "Health check"

    $clamd = Test-Port 3310
    $scanner = Test-Port 3030
    Write-Host ("  clamd   (3310): {0}" -f $(if ($clamd) { "UP" } else { "DOWN" }))
    Write-Host ("  scanner (3030): {0}" -f $(if ($scanner) { "UP" } else { "DOWN" }))

    if ($scanner) {
        try {
            $h = Invoke-RestMethod -Uri "http://127.0.0.1:3030/health" -TimeoutSec 20
            Write-Host ("  engine : {0}" -f $h.engine)
            Write-Host ("  status : {0}" -f $h.status)
        } catch {
            Write-Bad "scanner is up but /health failed: $($_.Exception.Message)"
        }
    }

    exit $(if ($clamd -and $scanner) { 0 } else { 1 })
}

# -- 1. clamd ----------------------------------------------------------------
Write-Step "ClamAV daemon (clamd)"
if (Test-Port 3310) {
    Write-Ok "already listening on 3310"
}
else {
    $conf = Join-Path $ClamAvDir "clamd.conf"
    $clamdExe = Join-Path $ClamAvDir "clamd.exe"
    if (-not (Test-Path $clamdExe)) {
        Write-Bad "$clamdExe not found. Run scripts\setup-clamav.ps1 first."
        exit 1
    }
    if (-not (Test-Path $conf)) {
        Write-Bad "$conf not found. Run scripts\setup-clamav.ps1 first."
        exit 1
    }

    Write-Host "  starting clamd (loading signatures, may take ~30s)..."
    Start-Process -FilePath $clamdExe `
        -ArgumentList "--config-file=`"$conf`"" `
        -WorkingDirectory $ClamAvDir `
        -WindowStyle Hidden

    $ok = $false
    foreach ($i in 1..24) {
        Start-Sleep -Seconds 5
        if (Test-Port 3310) { $ok = $true; break }
        Write-Host "    waiting... ($($i * 5)s)"
    }
    if ($ok) { Write-Ok "listening on 3310" } else { Write-Bad "did not open port 3310 (check $ClamAvDir\clamd.log)"; exit 1 }
}

# -- 2. scanner service ---------------------------------------------------------
Write-Step "Scanner service (port 3030)"
if (Test-Port 3030) {
    Write-Ok "already listening on 3030"
}
else {
    if (-not (Test-Path (Join-Path $ScannerDir ".env"))) {
        Write-Bad "$ScannerDir\.env missing. Copy .env.example and set SCAN_API_KEY."
        exit 1
    }

    Write-Host "  starting node server..."
    Start-Process -FilePath "node" -ArgumentList "server.js" `
        -WorkingDirectory (Join-Path $root $ScannerDir) `
        -WindowStyle Hidden

    $ok = $false
    foreach ($i in 1..12) {
        Start-Sleep -Seconds 2
        if (Test-Port 3030) { $ok = $true; break }
    }
    if ($ok) {
        try {
            $h = Invoke-RestMethod -Uri "http://127.0.0.1:3030/health" -TimeoutSec 30
            Write-Ok "listening on 3030 - $($h.engine)"
        } catch {
            Write-Bad "port is open but /health failed: $($_.Exception.Message)"
        }
    }
    else {
        Write-Bad "scanner did not start. Check the scanner terminal for errors."
        exit 1
    }
}

# -- 3. public tunnel -----------------------------------------------------------
if ($SkipTunnel) {
    Write-Step "Skipping the tunnel (local only)"
    Write-Host "  The Supabase Edge Function cannot reach a local URL."
    Write-Host "  Test with: .\scripts\test-clamav-scan.ps1"
    exit 0
}

Write-Step "Public tunnel (cloudflared)"
$cf = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
if (-not (Test-Path $cf)) {
    Write-Bad "cloudflared not found at $cf. Run: winget install Cloudflare.cloudflared"
    Write-Host "  (until then you can still test locally: scripts\test-clamav-scan.ps1)"
    exit 1
}

Write-Host "  starting cloudflared, watch for the https://...trycloudflare.com URL"
Write-Host ""
Write-Host "  ------------------------------------------------------------" -ForegroundColor Yellow
Write-Host "  Copy the URL printed below into the Supabase function secret:" -ForegroundColor Yellow
Write-Host "    CLAMAV_SCAN_URL = <the https:...trycloudflare.com URL>" -ForegroundColor Yellow
Write-Host "  ------------------------------------------------------------" -ForegroundColor Yellow
Write-Host ""

& $cf tunnel --url http://127.0.0.1:3030 --no-autoupdate
