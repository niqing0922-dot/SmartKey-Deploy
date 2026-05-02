param(
  [switch]$KeepLatestRelease = $true,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Remove-PathIfExists {
  param(
    [string]$TargetPath
  )

  if (-not (Test-Path -LiteralPath $TargetPath)) {
    return
  }

  if ($DryRun) {
    Write-Host "[dry-run] remove $TargetPath"
    return
  }

  Remove-Item -LiteralPath $TargetPath -Recurse -Force
  Write-Host "removed $TargetPath"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

Write-Host "Cleaning workspace at $repoRoot"

# Keep the latest release zip and matching extracted portable directory.
$keepPaths = @{}
if ($KeepLatestRelease -and (Test-Path -LiteralPath "release")) {
  $latestZip = Get-ChildItem -LiteralPath "release" -File -Filter "*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($latestZip) {
    $keepPaths[$latestZip.FullName] = $true
    $matchingDir = Join-Path $latestZip.DirectoryName ([System.IO.Path]::GetFileNameWithoutExtension($latestZip.Name))
    if (Test-Path -LiteralPath $matchingDir) {
      $keepPaths[(Resolve-Path -LiteralPath $matchingDir).Path] = $true
    }
  }
}

# Remove all node_modules except the kept release portable directory.
Get-ChildItem -LiteralPath . -Recurse -Directory -Force -Filter "node_modules" |
  ForEach-Object {
    $path = $_.FullName
    $skip = $false
    foreach ($keep in $keepPaths.Keys) {
      if ($path.StartsWith($keep, [System.StringComparison]::OrdinalIgnoreCase)) {
        $skip = $true
        break
      }
    }
    if (-not $skip) {
      Remove-PathIfExists -TargetPath $path
    }
  }

# Remove Python virtual environments.
Get-ChildItem -LiteralPath . -Recurse -Directory -Force -Filter ".venv" |
  ForEach-Object { Remove-PathIfExists -TargetPath $_.FullName }

# Remove common local caches.
@(".pytest_cache", ".tmp") | ForEach-Object {
  Remove-PathIfExists -TargetPath (Join-Path $repoRoot $_)
}

# Trim release to only kept items.
if (Test-Path -LiteralPath "release") {
  Get-ChildItem -LiteralPath "release" -Force | ForEach-Object {
    $full = $_.FullName
    $keep = $false
    foreach ($item in $keepPaths.Keys) {
      if ($full.Equals($item, [System.StringComparison]::OrdinalIgnoreCase)) {
        $keep = $true
        break
      }
    }
    if (-not $keep) {
      Remove-PathIfExists -TargetPath $full
    }
  }
}

Write-Host "Workspace cleanup complete."
