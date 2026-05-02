$ErrorActionPreference = 'Stop'

param(
  [string]$WebUrl = $env:SMARTKEY_DESKTOP_WEB_URL
)

if ([string]::IsNullOrWhiteSpace($WebUrl)) {
  throw "SMARTKEY_DESKTOP_WEB_URL is required. Example: https://your-web-app.example.com"
}

$env:SMARTKEY_DESKTOP_WEB_URL = $WebUrl.Trim()

Write-Output "Starting SmartKey desktop in cloud-web mode..."
Write-Output "Web URL: $($env:SMARTKEY_DESKTOP_WEB_URL)"

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
  & npm run desktop
} finally {
  Pop-Location
}
