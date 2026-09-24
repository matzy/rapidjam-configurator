[CmdletBinding()]
param(
  [string]$NodeVersion = 'v24.19.0',
  [ValidateSet('x64', 'arm64')]
  [string]$Architecture = 'x64',
  [string]$OutputDirectory = 'release',
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$releaseRoot = Join-Path $projectRoot $OutputDirectory
$stagingDirectory = Join-Path $releaseRoot 'rapidjam-configurator'
$runtimeDirectory = Join-Path $stagingDirectory 'runtime'
$archivePath = Join-Path $releaseRoot "rapidjam-configurator-$NodeVersion-win-$Architecture.zip"
$nodeArchiveName = "node-$NodeVersion-win-$Architecture.zip"
$nodeDownloadUrl = "https://nodejs.org/dist/$NodeVersion/$nodeArchiveName"
$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "rapidjam-node-$([guid]::NewGuid().ToString('N'))"
$nodeArchivePath = Join-Path $temporaryDirectory $nodeArchiveName

function Remove-PathIfPresent([string]$Path) {
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
}

try {
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'npm.cmd was not found. Install Node.js on the build machine first.'
  }

  Write-Host 'Building the production application...'
  Push-Location $projectRoot
  try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }

  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist\index.html'))) {
    throw 'dist/index.html was not generated.'
  }

  if ((Test-Path -LiteralPath $archivePath) -and -not $Force) {
    throw "The output archive already exists: $archivePath. Use -Force to replace it."
  }

  Write-Host "Preparing $archivePath ..."
  Remove-PathIfPresent $stagingDirectory
  if (-not (Test-Path -LiteralPath $releaseRoot)) {
    New-Item -ItemType Directory -Path $releaseRoot | Out-Null
  }
  New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null

  Write-Host "Downloading portable Node.js $NodeVersion ($Architecture)..."
  New-Item -ItemType Directory -Path $temporaryDirectory -Force | Out-Null
  Invoke-WebRequest -UseBasicParsing -Uri $nodeDownloadUrl -OutFile $nodeArchivePath
  Expand-Archive -LiteralPath $nodeArchivePath -DestinationPath $temporaryDirectory -Force

  $extractedNodeDirectory = Join-Path $temporaryDirectory "node-$NodeVersion-win-$Architecture"
  if (-not (Test-Path -LiteralPath (Join-Path $extractedNodeDirectory 'node.exe'))) {
    throw "The downloaded Node.js archive did not contain node.exe: $nodeDownloadUrl"
  }
  Copy-Item -Path (Join-Path $extractedNodeDirectory '*') -Destination $runtimeDirectory -Recurse -Force

  Copy-Item -Path (Join-Path $projectRoot 'dist') -Destination $stagingDirectory -Recurse -Force
  Copy-Item -Path (Join-Path $projectRoot 'server.mjs') -Destination $stagingDirectory -Force
  Copy-Item -Path (Join-Path $projectRoot 'start-rapidjam.cmd') -Destination $stagingDirectory -Force
  Copy-Item -Path (Join-Path $projectRoot 'DISTRIBUTION.md') -Destination $stagingDirectory -Force

  Compress-Archive -Path (Join-Path $stagingDirectory '*') -DestinationPath $archivePath -CompressionLevel Optimal -Force
  Write-Host "Created: $archivePath" -ForegroundColor Green
} finally {
  Remove-PathIfPresent $temporaryDirectory
  if (Test-Path -LiteralPath $stagingDirectory) {
    Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
  }
}
