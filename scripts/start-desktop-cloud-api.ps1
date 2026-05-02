$ErrorActionPreference = 'Stop'

param(
  [string]$ApiBaseUrl = $env:SMARTKEY_DESKTOP_API_BASE_URL
)

if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
  throw "SMARTKEY_DESKTOP_API_BASE_URL is required. Example: https://your-api.example.com/api"
}

$env:SMARTKEY_DESKTOP_API_BASE_URL = $ApiBaseUrl.Trim()

Write-Output "Starting SmartKey desktop in cloud-api mode..."
Write-Output "API base: $($env:SMARTKEY_DESKTOP_API_BASE_URL)"

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
  & npm run desktop
} finally {
  Pop-Location
}
