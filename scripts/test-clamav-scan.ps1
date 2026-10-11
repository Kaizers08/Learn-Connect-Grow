# scripts/test-clamav-scan.ps1
#
# Smoke test for the ClamAV virus scanner used by learning materials.
# Covers the whole chain: scanner service -> clamd daemon -> verdict.
#
# Usage:
#   .\scripts\test-clamav-scan.ps1
#   .\scripts\test-clamav-scan.ps1 -ScannerUrl "https://your-tunnel.loca.lt"
#
# Expected: every check PASSes.

[CmdletBinding()]
param(
    [string] $ScannerUrl = "http://localhost:3030",
    [string] $KeyFile = "scanner\.env"
)

$ErrorActionPreference = "Stop"

$results = @()

function Test-Case($name, [scriptblock]$check) {
    try {
        $ok = & $check
        $status = if ($ok) { "PASS" } else { "FAIL" }
    }
    catch {
        $status = "FAIL"
        Write-Host "      error: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
    $color = if ($status -eq "PASS") { "Green" } else { "Red" }
    Write-Host ("  [{0}] {1}" -f $status, $name) -ForegroundColor $color
    $script:results += $status
}

function Get-ScanKey {
    if (-not (Test-Path -LiteralPath $KeyFile)) {
        throw "Missing $KeyFile - patakbuhin muna ang scanner: cd scanner; npm install; npm start"
    }
    $line = Get-Content -LiteralPath $KeyFile |
        Where-Object { $_ -like "SCAN_API_KEY=*" } |
        Select-Object -First 1
    if (-not $line) { throw "Missing SCAN_API_KEY in $KeyFile" }
    return $line -replace "^SCAN_API_KEY=", ""
}

function Invoke-Scan($url, $key, $bytes) {
    return Invoke-RestMethod -Uri "$url/scan" -Method Post -TimeoutSec 180 `
        -Headers @{ "x-scan-key" = $key } `
        -ContentType "application/octet-stream" `
        -Body $bytes
}

Write-Host "`n=== ClamAV scanner smoke test ===" -ForegroundColor Cyan
Write-Host "Target: $ScannerUrl"

$key = Get-ScanKey
Write-Host "Key: $($key.Substring(0, 8))...`n"

# -- 1. Daemon is reachable and loaded its signatures -------------------------
Write-Host "1. Service health"
Test-Case "scanner responds on /health" {
    $h = Invoke-RestMethod -Uri "$ScannerUrl/health" -Method Get -TimeoutSec 30
    $h.status -eq "ok"
}
Write-Host ""

# -- 2. A clean file is reported clean ----------------------------------------
Write-Host "2. Clean file (real PDF fetched by the scanner)"

# A small public PDF, used as the "signed URL" the Edge Function would pass.
$pdfUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"

Test-Case "real PDF -> clean:true" {
    $r = Invoke-RestMethod -Uri "$ScannerUrl/scan" -Method Post -TimeoutSec 180 `
        -Headers @{ "x-scan-key" = $key } `
        -ContentType "application/json" `
        -Body (@{ url = $pdfUrl } | ConvertTo-Json)
    $r.clean -eq $true
}
Write-Host ""

# -- 3. An infected payload is reported infected ------------------------------
# EICAR is sent in memory, never written to disk: Windows Defender deletes any
# EICAR file it sees on disk, which would break this test.
Write-Host "3. Infected file (EICAR, sent in memory)"
Test-Case "EICAR -> clean:false + virus name" {
    $eicar = [Text.Encoding]::ASCII.GetBytes("X5O!P%@AP[4\PZX54(P^)7CC)7}`$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!`$H+H*")
    $r = Invoke-Scan $ScannerUrl $key $eicar
    ($r.clean -eq $false) -and ($r.virus -match "EICAR")
}
Write-Host ""

# -- 4. Failures must never be a pass -----------------------------------------
Write-Host "4. Failure handling"
Test-Case "wrong key -> 401" {
    $bad = $false
    try {
        Invoke-RestMethod -Uri "$ScannerUrl/scan" -Method Post -TimeoutSec 60 `
            -Headers @{ "x-scan-key" = "deliberately-wrong" } `
            -ContentType "application/octet-stream" -Body ([byte[]](1..10))
    }
    catch {
        $bad = ($_.Exception.Response.StatusCode.value__ -eq 401)
    }
    $bad
}

Test-Case "unreachable file url -> 5xx (never clean)" {
    $code = 0
    try {
        Invoke-RestMethod -Uri "$ScannerUrl/scan" -Method Post -TimeoutSec 60 `
            -Headers @{ "x-scan-key" = $key } `
            -ContentType "application/json" `
            -Body (@{ url = "http://127.0.0.1:9/nowhere" } | ConvertTo-Json)
    }
    catch {
        $code = $_.Exception.Response.StatusCode.value__
    }
    $code -ge 500
}
Write-Host ""

# -- Summary ------------------------------------------------------------------
$passed = ($results | Where-Object { $_ -eq "PASS" }).Count
$total = $results.Count

Write-Host "=== Summary: $passed/$total PASS ===" -ForegroundColor Cyan
if ($passed -eq $total) {
    Write-Host "All good. Ready to test on the website." -ForegroundColor Green
    exit 0
}

Write-Host "Some checks failed. Checklist:" -ForegroundColor Red
Write-Host "  - clamd tumatakbo ba?    Get-Process clamd"
Write-Host "  - scanner tumatakbo ba?  cd scanner; npm start"
Write-Host "  - tama ba ang SCAN_API_KEY sa scanner\.env?"
Write-Host "  - freshclam update:       C:\ClamAV\freshclam.exe --config-file=C:\ClamAV\freshclam.conf"
exit 1
