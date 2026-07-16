$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$package = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
$dist = Join-Path $root "dist"
$releaseDirectory = Join-Path $root "releases"
$folderName = "SampleX"
$stagingDirectory = Join-Path $releaseDirectory $folderName
$archive = Join-Path $releaseDirectory "SampleX-demo-trial-$($package.version).zip"
$readme = Join-Path $root "DEMO-README.txt"

if (-not (Test-Path -LiteralPath (Join-Path $dist "manifest.json"))) {
  throw "The extension build is missing dist/manifest.json."
}
if (-not (Test-Path -LiteralPath $readme)) {
  throw "The Demo Trial README is missing: $readme"
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
if (Test-Path -LiteralPath $archive) {
  Remove-Item -LiteralPath $archive -Force
}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archiveStream = [IO.File]::Open($archive, [IO.FileMode]::CreateNew)
$zip = [IO.Compression.ZipArchive]::new($archiveStream, [IO.Compression.ZipArchiveMode]::Create, $false)
try {
  $readmeEntry = $zip.CreateEntry("README.txt", [IO.Compression.CompressionLevel]::Optimal)
  $readmeSourceStream = [IO.File]::OpenRead($readme)
  $readmeEntryStream = $readmeEntry.Open()
  try {
    $readmeSourceStream.CopyTo($readmeEntryStream)
  } finally {
    $readmeEntryStream.Dispose()
    $readmeSourceStream.Dispose()
  }

  Get-ChildItem -LiteralPath $stagingDirectory -File -Recurse | ForEach-Object {
    $relativePath = $_.FullName.Substring($resolvedStaging.Length).TrimStart([char[]]@('\', '/')).Replace('\', '/')
    $entry = $zip.CreateEntry("SampleX/$relativePath", [IO.Compression.CompressionLevel]::Optimal)
    $sourceStream = [IO.File]::OpenRead($_.FullName)
    $entryStream = $entry.Open()
    try {
      $sourceStream.CopyTo($entryStream)
    } finally {
      $entryStream.Dispose()
      $sourceStream.Dispose()
    }
  }
} finally {
  $zip.Dispose()
  $archiveStream.Dispose()
}
Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
Write-Output $archive
