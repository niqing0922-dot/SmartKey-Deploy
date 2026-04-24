$ErrorActionPreference = 'Stop'

$root = Resolve-Path "$PSScriptRoot\.."
$exe = Join-Path $root 'release\SmartKey-portable\SmartKey.exe'

if (-not (Test-Path $exe)) {
  throw "Portable executable not found: $exe"
}

$process = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds 8
$alive = Get-Process -Id $process.Id -ErrorAction SilentlyContinue

if (-not $alive) {
  throw 'Portable executable exited before validation completed.'
}

Write-Output "Portable smoke passed. PID=$($process.Id)"
Stop-Process -Id $process.Id -Force
