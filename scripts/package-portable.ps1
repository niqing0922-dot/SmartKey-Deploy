$ErrorActionPreference = 'Stop'

$root = Resolve-Path "$PSScriptRoot\.."
$releaseRoot = Join-Path $root 'release\SmartKey-portable'
$zipPath = Join-Path $root 'release\SmartKey-portable.zip'

if (Test-Path $releaseRoot) {
  Remove-Item -Recurse -Force $releaseRoot
}
if (Test-Path $zipPath) {
  Remove-Item -Force $zipPath
}

Push-Location (Join-Path $root 'desktop')
try {
  & npm exec electron-builder -- --projectDir .. --win portable
} finally {
  Pop-Location
}
if ($LASTEXITCODE -ne 0) {
  throw "electron-builder portable packaging failed with exit code $LASTEXITCODE."
}

$portableExe = Get-ChildItem (Join-Path $root 'release') -Filter '*.exe' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $portableExe) {
  throw 'Portable build output was not found in release\.'
}

New-Item -ItemType Directory -Force $releaseRoot | Out-Null
Copy-Item -Force $portableExe.FullName (Join-Path $releaseRoot 'SmartKey.exe')

$readme = @"
SmartKey Portable
=================

Launch: SmartKey.exe

Requirements:
- Python available in PATH, or set SMARTKEY_PYTHON_PATH before launch
- Network access only if you use optional AI providers or optional integrations

Portable package path:
$releaseRoot
"@
Set-Content -Encoding utf8 (Join-Path $releaseRoot 'README.txt') $readme

$smartKeyExe = Join-Path $releaseRoot 'SmartKey.exe'
Compress-Archive -Path "$releaseRoot\*" -DestinationPath $zipPath -CompressionLevel Optimal

Write-Output "Portable package created at: $releaseRoot"
Write-Output "Portable zip created at: $zipPath"
Write-Output "Launch with: $smartKeyExe"
