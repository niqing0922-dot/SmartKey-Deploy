$ErrorActionPreference = 'Stop'

$root = Resolve-Path "$PSScriptRoot\.."
$distSource = Join-Path $root 'desktop\node_modules\electron\dist'
$releaseRoot = Join-Path $root 'release\SmartKey-portable'
$appRoot = Join-Path $releaseRoot 'resources\app'
$zipPath = Join-Path $root 'release\SmartKey-portable.zip'

if (-not (Test-Path $distSource)) {
  throw "Electron runtime not found at $distSource. Run npm --prefix desktop install before packaging."
}

if (Test-Path $releaseRoot) {
  Remove-Item -Recurse -Force $releaseRoot
}
if (Test-Path $zipPath) {
  Remove-Item -Force $zipPath
}

New-Item -ItemType Directory -Force $appRoot | Out-Null
Copy-Item -Recurse -Force "$distSource\*" $releaseRoot

$itemsToCopy = @('desktop', 'backend', 'frontend\dist', 'package.json')
foreach ($item in $itemsToCopy) {
  $source = Join-Path $root $item
  $target = Join-Path $appRoot $item
  if (Test-Path $source) {
    if ((Get-Item $source) -is [System.IO.DirectoryInfo]) {
      Copy-Item -Recurse -Force $source $target
    } else {
      New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
      Copy-Item -Force $source $target
    }
  }
}

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

$electronExe = Join-Path $releaseRoot 'electron.exe'
$smartKeyExe = Join-Path $releaseRoot 'SmartKey.exe'
if (Test-Path $electronExe) {
  Rename-Item -Path $electronExe -NewName 'SmartKey.exe'
}

Compress-Archive -Path "$releaseRoot\*" -DestinationPath $zipPath -CompressionLevel Optimal

Write-Output "Portable package created at: $releaseRoot"
Write-Output "Portable zip created at: $zipPath"
Write-Output "Launch with: $smartKeyExe"
