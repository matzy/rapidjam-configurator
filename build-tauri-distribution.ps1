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
$targetDirectory = Join-Path $projectRoot 'src-tauri\target\x86_64-pc-windows-msvc\release'
$executableName = 'rapidjam-configurator.exe'
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'

if ((Test-Path -LiteralPath (Join-Path $cargoBin 'cargo.exe')) -and -not (Get-Command cargo.exe -ErrorAction SilentlyContinue)) {
  $env:PATH = "$cargoBin;$env:PATH"
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
  if (((Test-Path -LiteralPath $archivePath) -or (Test-Path -LiteralPath $checksumPath)) -and -not $Force) {
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
  New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null
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

  $userGuidePath = Join-Path $projectRoot 'docs\USER_GUIDE.ja.md'
  if (-not (Test-Path -LiteralPath $userGuidePath -PathType Leaf)) {
    throw "Required Japanese end-user guide is missing: $userGuidePath"
  }
  Copy-Item -LiteralPath $userGuidePath -Destination $stagingDirectory -Force
  $userGuideHash = (Get-FileHash -LiteralPath $userGuidePath -Algorithm SHA256).Hash.ToLowerInvariant()

  $npmSbomPath = Join-Path $stagingDirectory 'npm-production-sbom.spdx.json'
  & npm.cmd sbom --sbom-format=spdx --omit=dev | Set-Content -LiteralPath $npmSbomPath -Encoding utf8
  if ($LASTEXITCODE -ne 0) { throw "npm SBOM generation failed with exit code $LASTEXITCODE." }

  $cargoSbomPath = Join-Path $stagingDirectory 'cargo-windows-x64-metadata.json'
  & cargo.exe metadata --manifest-path (Join-Path $projectRoot 'src-tauri\Cargo.toml') --format-version 1 --locked --filter-platform x86_64-pc-windows-msvc |
    Set-Content -LiteralPath $cargoSbomPath -Encoding utf8
  if ($LASTEXITCODE -ne 0) { throw "Cargo metadata generation failed with exit code $LASTEXITCODE." }

  $cargoNoticePath = Join-Path $stagingDirectory 'THIRD-PARTY-NOTICES-RUST-DRAFT.md'
  & cargo-about.exe generate `
    (Join-Path $projectRoot 'src-tauri\about.hbs') `
    --manifest-path (Join-Path $projectRoot 'src-tauri\Cargo.toml') `
    --config (Join-Path $projectRoot 'src-tauri\about.toml') `
    --target x86_64-pc-windows-msvc `
    --locked `
    --fail `
    --output-file $cargoNoticePath
  if ($LASTEXITCODE -ne 0) { throw "Rust third-party notice draft generation failed with exit code $LASTEXITCODE." }
  $cargoNoticeHash = (Get-FileHash -LiteralPath $cargoNoticePath -Algorithm SHA256).Hash.ToLowerInvariant()

  $npmNoticePath = Join-Path $stagingDirectory 'THIRD-PARTY-NOTICES-NPM.txt'
  Copy-Item -LiteralPath (Join-Path $projectRoot 'THIRD-PARTY-NOTICES-NPM.txt') -Destination $npmNoticePath
  $npmLicenseRoot = Join-Path $stagingDirectory 'THIRD-PARTY-LICENSES\npm'
  $npmLicenses = @(
    @{ Source = 'node_modules\@tauri-apps\api\LICENSE-APACHE-2.0'; Target = 'tauri-api\LICENSE-APACHE-2.0' },
    @{ Source = 'node_modules\@tauri-apps\api\LICENSE-MIT'; Target = 'tauri-api\LICENSE-MIT' },
    @{ Source = 'node_modules\lucide-react\LICENSE'; Target = 'lucide-react\LICENSE' },
    @{ Source = 'node_modules\react\LICENSE'; Target = 'react\LICENSE' },
    @{ Source = 'node_modules\react-dom\LICENSE'; Target = 'react-dom\LICENSE' },
    @{ Source = 'node_modules\scheduler\LICENSE'; Target = 'scheduler\LICENSE' }
  )
  foreach ($license in $npmLicenses) {
    $sourcePath = Join-Path $projectRoot $license.Source
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      throw "Required third-party license file is missing: $sourcePath"
    }
    $targetPath = Join-Path $npmLicenseRoot $license.Target
    New-Item -ItemType Directory -Path (Split-Path $targetPath -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
  }
  $npmNoticeHash = (Get-FileHash -LiteralPath $npmNoticePath -Algorithm SHA256).Hash.ToLowerInvariant()

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
    npmProductionSbomSha256 = (Get-FileHash -LiteralPath $npmSbomPath -Algorithm SHA256).Hash.ToLowerInvariant()
    cargoWindowsX64MetadataSha256 = (Get-FileHash -LiteralPath $cargoSbomPath -Algorithm SHA256).Hash.ToLowerInvariant()
    npmThirdPartyNoticeSha256 = $npmNoticeHash
    cargoThirdPartyNoticeDraftSha256 = $cargoNoticeHash
    japaneseUserGuideSha256 = $userGuideHash
    thirdPartyNoticeStatus = 'automatically generated draft; review it against the shipped executable before each release'
  }
  $manifestPath = Join-Path $stagingDirectory 'release-manifest.json'
  $manifestJson = $manifest | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText($manifestPath, $manifestJson, [System.Text.UTF8Encoding]::new($false))

  Copy-Item -LiteralPath (Join-Path $projectRoot 'DISTRIBUTION.md') -Destination $stagingDirectory

  if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
  Compress-Archive -Path (Join-Path $stagingDirectory '*') -DestinationPath $archivePath -CompressionLevel Optimal

  $hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  Set-Content -LiteralPath $checksumPath -Value "$hash  $releaseName.zip" -Encoding ascii
  if ($env:GITHUB_OUTPUT) {
    $outputLines = @(
      "release_name=$releaseName",
      "archive_path=$archivePath",
      "checksum_path=$checksumPath",
      "executable_path=$executablePath"
    )
    [System.IO.File]::AppendAllText($env:GITHUB_OUTPUT, (($outputLines -join "`n") + "`n"), [System.Text.UTF8Encoding]::new($false))
  }
  Write-Host "Created: $archivePath" -ForegroundColor Green
  Write-Host "SHA-256: $hash"
} finally {
  if (Test-Path -LiteralPath $stagingDirectory) {
    Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
  }
}
