$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$package = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
$dist = Join-Path $root "dist"
$releaseDirectory = Join-Path $root "releases"
$folderName = "SampleX"
$stagingDirectory = Join-Path $releaseDirectory $folderName
$archive = Join-Path $releaseDirectory "SampleX-beta-$($package.version).zip"

if (-not (Test-Path -LiteralPath (Join-Path $dist "manifest.json"))) {
  throw "The extension build is missing dist/manifest.json."
}

New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
$resolvedRelease = [IO.Path]::GetFullPath($releaseDirectory).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$resolvedStaging = [IO.Path]::GetFullPath($stagingDirectory)
if (-not $resolvedStaging.StartsWith($resolvedRelease, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Unsafe staging directory: $resolvedStaging"
}

if (Test-Path -LiteralPath $stagingDirectory) {
  Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
}

Copy-Item -LiteralPath $dist -Destination $stagingDirectory -Recurse
Compress-Archive -LiteralPath $stagingDirectory -DestinationPath $archive -CompressionLevel Optimal -Force
Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
Write-Output $archive
