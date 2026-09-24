# RapidJAM Configurator distribution

The configurator can run without a system-wide Node.js installation by bundling the Windows portable Node.js runtime.

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

The script builds the application, downloads the Windows portable Node.js runtime, and creates a ZIP under `release/`. Use `-Force` to replace an existing archive, or select another runtime with `-NodeVersion` and `-Architecture`.

The resulting ZIP contains:

```text
rapidjam-configurator/
  dist/
  runtime/node.exe
  server.mjs
  start-rapidjam.cmd
```

The other files from the Node.js archive remain in `runtime/`; keeping the complete extracted runtime is recommended.

## Run

On the target Windows PC, extract the ZIP and run `start-rapidjam.cmd`. Select option `3` for the built configurator. No Node.js installation or `npm install` is required.

The launcher uses `runtime/node.exe` first, then falls back to a system Node.js installation. The server listens only on `127.0.0.1` and proxies `/rapidjam-api/*` to `http://192.168.7.1`.

This package is Windows x64-specific. Create separate packages with the corresponding Node.js runtime for ARM64 or other operating systems.
