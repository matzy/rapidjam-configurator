[CmdletBinding()]
param(
  [switch]$ResolvePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'node-runtime.json') -Raw | ConvertFrom-Json
$runtimeDirectory = Join-Path $projectRoot 'runtime'

function Write-SetupMessage([string]$Message) {
  [Console]::Error.WriteLine("RapidJAM setup: $Message")
}

function Get-NativeArchitecture {
  $architecture = $env:PROCESSOR_ARCHITEW6432
  if ([string]::IsNullOrWhiteSpace($architecture)) { $architecture = $env:PROCESSOR_ARCHITECTURE }
  switch ($architecture.ToUpperInvariant()) {
    'AMD64' { return 'x64' }
    'ARM64' { return 'arm64' }
    default { throw "Unsupported Windows architecture: $architecture. RapidJAM supports x64 and arm64." }
  }
}

function Test-NodeVersion([string]$NodePath) {
  if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf)) { return $false }
  try { return ((& $NodePath --version 2>$null | Select-Object -First 1).Trim() -eq $manifest.version) } catch { return $false }
}

function Find-LocalNode {
  $nodePath = Join-Path $runtimeDirectory 'node.exe'
  if (Test-NodeVersion $nodePath) { return $nodePath }
  return $null
}

function Install-NodeRuntime([string]$Architecture) {
  $package = $manifest.architectures.$Architecture
  $temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "rapidjam-node-$([guid]::NewGuid().ToString('N'))"
  $archivePath = Join-Path $temporaryDirectory $package.archive
  try {
    New-Item -ItemType Directory -Path $temporaryDirectory -Force | Out-Null
    Write-SetupMessage "Downloading Node.js $($manifest.version) for Windows $Architecture."
    Write-SetupMessage "Source: $($package.url)"
    Invoke-WebRequest -UseBasicParsing -Uri $package.url -OutFile $archivePath
    $actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $package.sha256) { throw "SHA-256 verification failed. Expected $($package.sha256), received $actualHash." }
    $extractDirectory = Join-Path $temporaryDirectory 'extracted'
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractDirectory -Force
    $extractedDirectory = Join-Path $extractDirectory ("node-$($manifest.version)-win-$Architecture")
    $downloadedNode = Join-Path $extractedDirectory 'node.exe'
    if (-not (Test-NodeVersion $downloadedNode)) { throw "The downloaded Node.js runtime did not report $($manifest.version)." }
    $runtimeStage = Join-Path $temporaryDirectory 'runtime'
    New-Item -ItemType Directory -Path $runtimeStage -Force | Out-Null
    Copy-Item -Path (Join-Path $extractedDirectory '*') -Destination $runtimeStage -Recurse -Force
    if (Test-Path -LiteralPath $runtimeDirectory) { Remove-Item -LiteralPath $runtimeDirectory -Recurse -Force }
    Move-Item -LiteralPath $runtimeStage -Destination $runtimeDirectory
    return (Join-Path $runtimeDirectory 'node.exe')
  } finally {
    if (Test-Path -LiteralPath $temporaryDirectory) { Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force }
  }
}

try {
  $architecture = Get-NativeArchitecture
  $nodePath = Find-LocalNode
  if ($nodePath) {
    Write-SetupMessage "Using downloaded Node.js $($manifest.version): $nodePath"
  } else {
    Write-SetupMessage "Downloaded Node.js $($manifest.version) was not found."
    Write-SetupMessage "The runtime will be saved under: $runtimeDirectory"
    $answer = Read-Host 'Download and install the verified runtime now? [Y/N]'
    if ($answer -notmatch '^(?i)y(es)?$') { throw 'Node.js setup was cancelled.' }
    $nodePath = Install-NodeRuntime $architecture
  }
  if ($ResolvePath) { Write-Output $nodePath } else { Write-Host "Node.js $($manifest.version) is ready: $nodePath" -ForegroundColor Green }
} catch {
  Write-SetupMessage $_.Exception.Message
  exit 1
}