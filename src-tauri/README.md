# Tauri desktop build notes

- The bundled frontend uses the existing React/Vite app; no Node.js runtime is required on target PCs.
- Development runs Vite/Tauri on `127.0.0.1:5174` and the frontend preview on `127.0.0.1:4174`; both use strict port binding. The legacy server's parallel-worktree command is `npm run serve:parallel` on port 5175. Port 5173 remains the legacy server's compatibility default.
- `npm run tauri:dev` merges `tauri.dev.conf.json` to use a development-only WebView2 data directory (`%LOCALAPPDATA%\Goppa\rapidjam.configurator-dev\EBWebView`). Release builds continue to use the production directory configured in `tauri.conf.json`.
- Device networking is performed by the `device_request` Rust command. It only permits an explicit list of WebConfig endpoints on `http://192.168.7.1`.
- This first portable build uses the system Evergreen WebView2 Runtime. Confirm the runtime is present on every deployment target. Windows 11 normally includes it; some Windows 10 PCs may not.
- WebView2 profile/cache data uses `%LOCALAPPDATA%\Goppa\rapidjam.configurator\EBWebView`. It is created on first launch and remains after the application ZIP is moved or deleted. Close the app before removing that directory to reset its WebView profile.
- Fixed Version WebView2 is not included in this build. A separate portable fixed-runtime configuration must be verified on supported Windows 10 targets before it can be promised.
