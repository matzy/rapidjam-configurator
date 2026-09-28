# RapidJAM Configurator distribution

Two Windows distribution paths are available while the desktop migration is being validated:

- **Tauri desktop (new):** a native app window, React assets embedded in the executable, and Rust HTTP requests to the controller. No Node.js or internet connection is needed on the target PC. The first package targets Windows x64.
- **Browser/Node launcher (legacy):** the existing local HTTP server and browser launch path. Keep it as a recovery/development option until the Tauri package passes real-device acceptance tests.

## Tauri desktop build (Windows x64)

### Build prerequisites

The build machine requires Node.js/npm, Rust stable with the `x86_64-pc-windows-msvc` target, Visual Studio C++ Build Tools / Windows SDK for the MSVC target, and the pinned `cargo-about 0.9.2` CLI for generating the Rust license draft. Run `npm ci` after checking out the repository.

### Build the portable ZIP

From PowerShell in this directory, run `./build-tauri-distribution.ps1`. The script runs the production Vite build and desktop release build, then writes a versioned archive such as `release/rapidjam-configurator-x64-0.4.0.zip` and a matching SHA-256 sidecar. If that version already exists, the script stops; use `-Force` only when intentionally replacing a release artifact.

The ZIP contains the application executable, `WebView2Loader.dll`, npm production SPDX SBOM, Windows x64 Cargo metadata, generated third-party notice drafts, release manifest and this document. **The notice files are audit drafts, not yet reviewed consumer notices.** The consumer release must additionally include the application license and Japanese user guide. The frontend is embedded in the executable; the target PC does not need Node.js, npm, or a browser tab. Extract it and launch `rapidjam-configurator.exe`. Tauri/WebView2 profile and cache data are stored per-user at `%LOCALAPPDATA%\Goppa\rapidjam.configurator\EBWebView`, not next to the EXE. The folder is created at first launch and persists when the ZIP is moved or removed. To reset the WebView profile, close the app and remove that `EBWebView` folder; this clears WebView cache and local web data.

### WebView2 requirement and update responsibility

This first portable build uses the Windows **Evergreen WebView2 Runtime** already installed on the target. Windows 11 normally includes it, and most Windows 10 machines have it, but an older or managed Windows 10 PC may not. The package intentionally does not download or silently install WebView2. Confirm WebView2 is present before delivery; if missing, the deployment owner must arrange an approved WebView2 installation before using this build.

With Evergreen, Microsoft supplies runtime security updates through its update mechanism. If the target PC is offline or its Edge/WebView2 updates are disabled, those updates will not arrive; agree with the recipient's IT owner on an update path. A Fixed Version WebView2 portable package is **not included**: it would need the full runtime shipped beside the app, explicit runtime selection and Windows-version-specific validation, and the distributor would then be responsible for rebuilding and redistributing runtime security updates. Do not promise support for WebView2-missing PCs until that separate package has passed acceptance tests. A single-file EXE is not the current goal.

### Hardware requirements

RapidJAM must be connected in WebConfig/RNDIS mode and reachable at `http://192.168.7.1`. The desktop app's Rust bridge only allows the listed RapidJAM WebConfig GET/POST API endpoints; it does not expose arbitrary URLs or act as a general HTTP proxy. Rebooting the controller into gamepad mode will naturally drop the WebConfig connection.

### Acceptance checklist before delivery

- Test on clean Windows 10 and 11 x64 machines with WebView2 installed, including an offline launch.
- Confirm the extracted app runs as a non-admin user from a local folder with spaces and Japanese characters in its path, and that WebView2 data is created at `%LOCALAPPDATA%\Goppa\rapidjam.configurator\EBWebView` rather than alongside the EXE.
- Test connection errors, reading settings, saving and reading them back, reboot-to-gamepad, and Hall calibration on real RapidJAM hardware.
- Record the archive SHA-256 and confirm the recipient's SmartScreen/signing expectations. The current package is not code-signed.
- Keep the legacy launcher available until all device write/readback checks pass.

## Legacy browser/Node distribution

`build-distribution.ps1` still builds the old browser package ZIP. Its launcher uses a verified portable Node runtime which may be downloaded on the target PC on first launch, opens the default browser, and proxies `/rapidjam-api/*` through a loopback server. This path is not the new offline native-window distribution and should only be used where that behavior is acceptable.

## Developer commands

- `npm run dev:setup -- --base-port 5180` — create ignored per-worktree settings (Vite/Tauri 5180, legacy server 5181, preview 5182, and a worktree-specific WebView2 profile). Choose a base whose three ports are unused. It refuses to overwrite `.env.local` unless `--force` is specified.
- `npm run dev:show` — display the effective per-worktree URLs and profile.
- `npm run dev` — browser UI at the configured Vite port with the proxy to the device; strict port binding prevents silently using another port. Without `.env.local`, standalone defaults are 5173/5174/5175.
- `npm run build` — TypeScript validation and production frontend build.
- `npm run preview` — production frontend preview at the configured preview port; strict port binding is enabled.
- `npm run tauri:dev` — Tauri window with hot-reloaded frontend at the configured Vite port; Rust toolchain required. An ignored Tauri override is generated from `.env.local`, including a worktree-specific WebView2 data path.
- `npm run tauri:build -- --no-bundle` — build the Tauri app executable without an installer.
- `npm run serve:parallel` — legacy production web server at the configured legacy port (override with `PORT` if needed).
- `npm run serve` — legacy production web server; retains port 5173 for compatibility. Use `serve:parallel` in this checkout when another VS Code instance may already use 5173.

Each worktree's `.env.local` is ignored and is not shared with other worktrees. To change ports, rerun `npm run dev:setup -- --base-port <unused-port> --force`. These development ports are loopback-only and independent of the controller's fixed WebConfig address (`192.168.7.1`). The physical controller itself is still a shared resource: coordinate real-device writes/calibration with other work and use Mock transport while it is in use elsewhere. Build outputs (`dist/`, `src-tauri/target/`, and `release/`) are isolated only when each VS Code instance uses a separate checkout/worktree; do not run concurrent builds in the same checkout or overwrite a shared release archive.
