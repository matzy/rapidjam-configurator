[CmdletBinding()]
param(
  [string]$OutputDirectory = 'release',
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$releaseRoot = Join-Path $projectRoot $OutputDirectory
$stagingDirectory = Join-Path $releaseRoot 'rapidjam-configurator'
$archivePath = Join-Path $releaseRoot 'rapidjam-configurator.zip'

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
  New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null
  Copy-Item -Path (Join-Path $projectRoot 'dist') -Destination (Join-Path $stagingDirectory 'dist') -Recurse -Force
  Copy-Item -Path (Join-Path $projectRoot 'server.mjs') -Destination $stagingDirectory -Force
  Copy-Item -Path (Join-Path $projectRoot 'start-rapidjam.cmd') -Destination $stagingDirectory -Force
  Copy-Item -Path (Join-Path $projectRoot 'setup.ps1') -Destination $stagingDirectory -Force
  Copy-Item -Path (Join-Path $projectRoot 'node-runtime.json') -Destination $stagingDirectory -Force
  Copy-Item -Path (Join-Path $projectRoot 'DISTRIBUTION.md') -Destination $stagingDirectory -Force
  $userGuidePath = Join-Path $projectRoot 'docs\USER_GUIDE.ja.md'
  if (-not (Test-Path -LiteralPath $userGuidePath -PathType Leaf)) {
    throw "Required Japanese end-user guide is missing: $userGuidePath"
  }
  Copy-Item -Path $userGuidePath -Destination $stagingDirectory -Force

  Compress-Archive -Path (Join-Path $stagingDirectory '*') -DestinationPath $archivePath -CompressionLevel Optimal -Force
  Write-Host "Created: $archivePath" -ForegroundColor Green
} finally {
  if (Test-Path -LiteralPath $stagingDirectory) {
    Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
  }
}
