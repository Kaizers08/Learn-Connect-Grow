# Enable Google OAuth on Supabase via Management API.
# Token: https://supabase.com/dashboard/account/tokens
#
# Usage:
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#   $env:GOOGLE_CLIENT_ID = "....apps.googleusercontent.com"
#   $env:GOOGLE_CLIENT_SECRET = "GOCSPX-..."
#   .\scripts\configure-google-auth.ps1

$ErrorActionPreference = "Stop"

$ProjectRef = "wblacddvxokokjcwnnrm"
$Token = $env:SUPABASE_ACCESS_TOKEN
$ClientId = $env:GOOGLE_CLIENT_ID
$ClientSecret = $env:GOOGLE_CLIENT_SECRET

if (-not $Token -or -not $ClientId -or -not $ClientSecret) {
  Write-Host "Set these env vars first:" -ForegroundColor Yellow
  Write-Host '  $env:SUPABASE_ACCESS_TOKEN = "sbp_..."'
  Write-Host '  $env:GOOGLE_CLIENT_ID = "..."'
  Write-Host '  $env:GOOGLE_CLIENT_SECRET = "..."'
  exit 1
}

$headers = @{
  Authorization = "Bearer $Token"
  "Content-Type" = "application/json"
}

$siteUrl = if ($env:APP_SITE_URL) { $env:APP_SITE_URL } else { "http://localhost:4200" }
$redirectUrls = if ($env:APP_REDIRECT_URLS) {
  $env:APP_REDIRECT_URLS
} else {
  "http://localhost:4200/**,http://localhost:4200/auth/callback"
}

$body = @{
  external_google_enabled = $true
  external_google_client_id = $ClientId
  external_google_secret = $ClientSecret
  site_url = $siteUrl
  uri_allow_list = $redirectUrls
} | ConvertTo-Json

Invoke-RestMethod -Method Patch `
  -Uri "https://api.supabase.com/v1/projects/$ProjectRef/config/auth" `
  -Headers $headers `
  -Body $body | Out-Null

Write-Host "Google OAuth configured." -ForegroundColor Green
