$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$package = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
$dist = Join-Path $root "dist"
$releaseDirectory = Join-Path $root "releases"
$archive = Join-Path $releaseDirectory "samplex-$($package.version).zip"

if (-not (Test-Path -LiteralPath (Join-Path $dist "manifest.json"))) {
  throw "The extension build is missing dist/manifest.json."
}

New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
Compress-Archive -Path (Join-Path $dist "*") -DestinationPath $archive -CompressionLevel Optimal -Force
Write-Output $archive
