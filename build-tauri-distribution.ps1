[CmdletBinding()]
param(
  [switch]$Force,
  [string]$FirmwareCompatibility = 'UNCONFIRMED'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$releaseRoot = Join-Path $projectRoot 'release'
$appManifest = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$releaseName = "rapidjam-configurator-x64-$($appManifest.version)"
$stagingDirectory = Join-Path $releaseRoot $releaseName
$archivePath = Join-Path $releaseRoot "$releaseName.zip"
$checksumPath = Join-Path $releaseRoot "$releaseName.zip.sha256"
$auditDirectory = Join-Path $releaseRoot "$releaseName-audit"
$targetDirectory = Join-Path $projectRoot 'src-tauri\target\x86_64-pc-windows-msvc\release'
$executableName = 'rapidjam-configurator.exe'
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'

if ((Test-Path -LiteralPath (Join-Path $cargoBin 'cargo.exe')) -and -not (Get-Command cargo.exe -ErrorAction SilentlyContinue)) {
  $env:PATH = "$cargoBin;$env:PATH"
}

function Read-RequiredFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Required file is missing: $Path"
  }
  return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Write-WindowsText {
  param([string]$Path, [string]$Text)
  $crlfText = $Text -replace "`r?`n", "`r`n"
  [System.IO.File]::WriteAllText($Path, $crlfText, [System.Text.UTF8Encoding]::new($false))
}

function Get-Sha256 {
  param([string]$Path)
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

try {
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'npm.cmd was not found. Install Node.js on the build machine first.'
  }
  if (-not (Get-Command cargo.exe -ErrorAction SilentlyContinue)) {
    throw 'cargo.exe was not found. Install the Rust MSVC toolchain and Windows C++ build tools first.'
  }
  if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    throw 'node.exe was not found. Install the supported Node.js build toolchain first.'
  }
  $cargoAbout = Get-Command cargo-about.exe -ErrorAction SilentlyContinue
  if (-not $cargoAbout) {
    throw 'cargo-about.exe was not found. Install the pinned cargo-about license-audit tool on the build machine.'
  }
  $cargoAboutVersion = (& $cargoAbout.Source --version 2>$null | Select-Object -First 1).Trim()
  if ($cargoAboutVersion -ne 'cargo-about 0.9.2') {
    throw "cargo-about 0.9.2 is required for a reproducible release audit; found '$cargoAboutVersion'."
  }
  if (((Test-Path -LiteralPath $archivePath) -or (Test-Path -LiteralPath $checksumPath) -or (Test-Path -LiteralPath $auditDirectory)) -and -not $Force) {
    throw "The versioned release already exists: $releaseName. Use -Force only when intentionally replacing this release."
  }

  Push-Location $projectRoot
  try {
    Write-Host 'Checking release version and exact dependency pins...'
    & node.exe (Join-Path $projectRoot 'scripts\check-release-metadata.mjs') $projectRoot
    if ($LASTEXITCODE -ne 0) { throw "Release metadata check failed with exit code $LASTEXITCODE." }

    Write-Host 'Building the Windows x64 Tauri application...'
    & npm.cmd run tauri:build -- --target x86_64-pc-windows-msvc --no-bundle
    if ($LASTEXITCODE -ne 0) { throw "Tauri build failed with exit code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }

  $executablePath = Join-Path $targetDirectory $executableName
  if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
    throw "Tauri executable was not found: $executablePath"
  }

  if (-not (Test-Path -LiteralPath $releaseRoot)) {
    New-Item -ItemType Directory -Path $releaseRoot | Out-Null
  }
  if (Test-Path -LiteralPath $stagingDirectory) {
    Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
  }
  if (Test-Path -LiteralPath $auditDirectory) {
    Remove-Item -LiteralPath $auditDirectory -Recurse -Force
  }
  New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null
  New-Item -ItemType Directory -Path $auditDirectory -Force | Out-Null
  Copy-Item -LiteralPath $executablePath -Destination $stagingDirectory

  Get-ChildItem -LiteralPath $targetDirectory -Filter '*.dll' -File | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $stagingDirectory -Force
  }

  $webViewLoader = Get-ChildItem -LiteralPath (Join-Path $targetDirectory 'build') -Directory -Filter 'webview2-com-sys-*' -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName 'out\x64\WebView2Loader.dll' } |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
    Select-Object -First 1
  if (-not $webViewLoader) {
    throw 'WebView2Loader.dll was not found in the Tauri build output.'
  }
  Copy-Item -LiteralPath $webViewLoader -Destination $stagingDirectory -Force

  $userGuideJaPath = Join-Path $projectRoot 'docs\USER_GUIDE.ja.md'
  Write-WindowsText (Join-Path $stagingDirectory 'USER_GUIDE.ja.md') (Read-RequiredFile $userGuideJaPath)
  $userGuideEnPath = Join-Path $projectRoot 'docs\USER_GUIDE.en.md'
  Write-WindowsText (Join-Path $stagingDirectory 'USER_GUIDE.en.md') (Read-RequiredFile $userGuideEnPath)
  Write-WindowsText (Join-Path $stagingDirectory 'LICENSE.txt') (Read-RequiredFile (Join-Path $projectRoot 'LICENSE'))
  Write-WindowsText (Join-Path $stagingDirectory 'README.txt') (Read-RequiredFile (Join-Path $projectRoot 'packaging\README.txt'))

  $npmSbomPath = Join-Path $auditDirectory 'npm-production-sbom.spdx.json'
  & npm.cmd sbom --sbom-format=spdx --omit=dev | Set-Content -LiteralPath $npmSbomPath -Encoding utf8
  if ($LASTEXITCODE -ne 0) { throw "npm SBOM generation failed with exit code $LASTEXITCODE." }

  $cargoSbomPath = Join-Path $auditDirectory 'cargo-windows-x64-metadata.json'
  & cargo.exe metadata --manifest-path (Join-Path $projectRoot 'src-tauri\Cargo.toml') --format-version 1 --locked --filter-platform x86_64-pc-windows-msvc |
    Set-Content -LiteralPath $cargoSbomPath -Encoding utf8
  if ($LASTEXITCODE -ne 0) { throw "Cargo metadata generation failed with exit code $LASTEXITCODE." }

  $cargoNoticePath = Join-Path $releaseRoot "$releaseName.rust-notices.tmp.md"
  & cargo-about.exe generate `
    (Join-Path $projectRoot 'src-tauri\about.hbs') `
    --manifest-path (Join-Path $projectRoot 'src-tauri\Cargo.toml') `
    --config (Join-Path $projectRoot 'src-tauri\about.toml') `
    --target x86_64-pc-windows-msvc `
    --locked `
    --fail `
    --output-file $cargoNoticePath
  if ($LASTEXITCODE -ne 0) { throw "Rust third-party notice generation failed with exit code $LASTEXITCODE." }

  $npmLicenses = @(
    @{ Source = 'node_modules\@tauri-apps\api\LICENSE-APACHE-2.0'; Name = 'tauri-api/LICENSE-APACHE-2.0' },
    @{ Source = 'node_modules\@tauri-apps\api\LICENSE-MIT'; Name = 'tauri-api/LICENSE-MIT' },
    @{ Source = 'node_modules\lucide-react\LICENSE'; Name = 'lucide-react/LICENSE' },
    @{ Source = 'node_modules\react\LICENSE'; Name = 'react/LICENSE' },
    @{ Source = 'node_modules\react-dom\LICENSE'; Name = 'react-dom/LICENSE' },
    @{ Source = 'node_modules\scheduler\LICENSE'; Name = 'scheduler/LICENSE' }
  )
  $npmLicenseSections = foreach ($license in $npmLicenses) {
    $licenseText = Read-RequiredFile (Join-Path $projectRoot $license.Source)
    "----- $($license.Name) -----`r`n$($licenseText.TrimEnd())"
  }

  $rustNoticeText = Read-RequiredFile $cargoNoticePath
  $noticeText = @(
    "RapidJAM Configurator $($appManifest.version) - third-party notices",
    '',
    'This file lists the third-party components included in RapidJAM Configurator.',
    'RapidJAM Configurator itself is distributed under the MIT License (see LICENSE.txt).',
    '',
    (Read-RequiredFile (Join-Path $projectRoot 'THIRD-PARTY-NOTICES-NPM.txt')).TrimEnd(),
    '',
    '================================================================================',
    'JavaScript license texts',
    '================================================================================',
    '',
    ($npmLicenseSections -join "`r`n`r`n"),
    '',
    $rustNoticeText.TrimEnd(),
    ''
  ) -join "`r`n"
  $thirdPartyNoticePath = Join-Path $stagingDirectory 'THIRD-PARTY-NOTICES.txt'
  Write-WindowsText $thirdPartyNoticePath $noticeText
  $thirdPartyNoticeHash = Get-Sha256 $thirdPartyNoticePath

  $gitCommit = 'unknown'
  $gitDirty = $true
  $gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
  if ($gitCommand) {
    $commitOutput = @(& $gitCommand.Source -C $projectRoot rev-parse HEAD 2>$null)
    $commitCandidate = $commitOutput | Where-Object { $_ -match '^[0-9a-fA-F]{40}$' } | Select-Object -First 1
    if ($commitCandidate) {
      $gitCommit = $commitCandidate.Trim()
      $gitChanges = @(& $gitCommand.Source -C $projectRoot status --porcelain 2>$null)
      $gitDirty = $gitChanges.Count -gt 0
    }
  }
  $manifest = [ordered]@{
    product = $appManifest.name
    version = $appManifest.version
    target = 'x86_64-pc-windows-msvc'
    builtAtUtc = [DateTime]::UtcNow.ToString('o')
    sourceCommit = $gitCommit
    sourceTreeDirty = $gitDirty
    firmwareCompatibility = $FirmwareCompatibility
    webView2Mode = 'Evergreen system runtime; runtime is not bundled'
    signingStatus = 'unsigned release candidate'
    executableSha256 = Get-Sha256 (Join-Path $stagingDirectory $executableName)
    webView2LoaderSha256 = Get-Sha256 (Join-Path $stagingDirectory 'WebView2Loader.dll')
    licenseSha256 = Get-Sha256 (Join-Path $stagingDirectory 'LICENSE.txt')
    readmeSha256 = Get-Sha256 (Join-Path $stagingDirectory 'README.txt')
    userGuideJaSha256 = Get-Sha256 (Join-Path $stagingDirectory 'USER_GUIDE.ja.md')
    userGuideEnSha256 = Get-Sha256 (Join-Path $stagingDirectory 'USER_GUIDE.en.md')
    thirdPartyNoticesSha256 = $thirdPartyNoticeHash
    npmProductionSbomSha256 = Get-Sha256 $npmSbomPath
    cargoWindowsX64MetadataSha256 = Get-Sha256 $cargoSbomPath
    thirdPartyNoticeStatus = 'generated from the npm production SBOM and cargo-about; review against the shipped executable before each release'
  }

  if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $stagingRoot = $stagingDirectory.TrimEnd('\')
  $archiveStream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::CreateNew)
  try {
    $archiveWriter = New-Object System.IO.Compression.ZipArchive($archiveStream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
      # Entry names must use '/' separators; CreateFromDirectory writes '\' on .NET Framework.
      Get-ChildItem -LiteralPath $stagingRoot -File -Recurse | ForEach-Object {
        $relativePath = $_.FullName.Substring($stagingRoot.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archiveWriter, $_.FullName, "$releaseName/$relativePath", [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
      }
    } finally {
      $archiveWriter.Dispose()
    }
  } finally {
    $archiveStream.Dispose()
  }

  $archiveHash = Get-Sha256 $archivePath
  $zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
  try {
    $archiveContents = @($zip.Entries | Where-Object { -not $_.FullName.EndsWith('/') } | ForEach-Object { $_.FullName })
  } finally {
    $zip.Dispose()
  }
  $manifest['archiveSha256'] = $archiveHash
  $manifest['archiveContents'] = $archiveContents

  $manifestPath = Join-Path $auditDirectory 'release-manifest.json'
  $manifestJson = $manifest | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText($manifestPath, $manifestJson, [System.Text.UTF8Encoding]::new($false))

  Set-Content -LiteralPath $checksumPath -Value "$archiveHash  $releaseName.zip" -Encoding ascii
  Write-Host "Created: $archivePath" -ForegroundColor Green
  Write-Host "SHA-256: $archiveHash"
  Write-Host "Audit files (keep locally, do not publish): $auditDirectory" -ForegroundColor Yellow
  Write-Host 'Review THIRD-PARTY-NOTICES.txt against the shipped executable before release.' -ForegroundColor Yellow
} finally {
  if (Test-Path -LiteralPath $stagingDirectory) {
    Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
  }
  $cargoNoticeTempPath = Join-Path $releaseRoot "$releaseName.rust-notices.tmp.md"
  if (Test-Path -LiteralPath $cargoNoticeTempPath) {
    Remove-Item -LiteralPath $cargoNoticeTempPath -Force
  }
}
