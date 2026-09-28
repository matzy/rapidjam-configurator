# RapidJAM Configurator distribution

The distribution contains the production configurator, but does not bundle Node.js in the ZIP. On first launch, the included setup script downloads and verifies the official portable Node.js `v24.19.0` runtime into the extracted folder when it is not already present there.

## Build the application

```powershell
npm install
npm run build
```

## Create a no-install package

Run the packaging script from PowerShell:

```powershell
.\build-distribution.ps1
```

The script builds the application and creates a ZIP under `release/`. Use `-Force` to replace an existing archive. Node.js is used on the build machine for `npm run build`, but is never copied into the ZIP.

The resulting ZIP contains:

```text
rapidjam-configurator/
  dist/
  server.mjs
  start-rapidjam.cmd
  setup.ps1
  node-runtime.json
```

## Run

On the target Windows PC, extract the ZIP and run `start-rapidjam.cmd`. There is no mode menu. The launcher starts the production HTTP configurator only, and never runs `npm install` or a production build on the target PC.

The launcher checks only `runtime/node.exe` inside the extracted distribution. System-wide and user-installed Node.js versions are never used, even when available. If the downloaded runtime is missing or has a different version, setup displays the official URL and asks for confirmation before downloading. The archive is checked against its pinned SHA-256 before it is installed.

The downloaded runtime is stored under `runtime/` beside the extracted distribution. A network connection is required only for the first download. PowerShell 5.1 or later and permission to write to the extracted folder are required; administrator privileges are not.

The server listens only on `127.0.0.1` and proxies `/rapidjam-api/*` to `http://192.168.7.1`.

The package supports Windows x64 and arm64. Other operating systems are not supported by this launcher.

## Updating the tested Node.js version

Update `node-runtime.json` with the new official archive URLs and SHA-256 values only after validating the runtime with `npm run build` and a clean first-launch test on each supported architecture.
