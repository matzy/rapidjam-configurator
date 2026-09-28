# Tauri desktop build notes

- The bundled frontend uses the existing React/Vite app; no Node.js runtime is required on target PCs.
- Device networking is performed by the `device_request` Rust command. It only permits an explicit list of WebConfig endpoints on `http://192.168.7.1`.
- This first portable build uses the system Evergreen WebView2 Runtime. Confirm the runtime is present on every deployment target. Windows 11 normally includes it; some Windows 10 PCs may not.
- WebView2 profile/cache data uses `%LOCALAPPDATA%\Goppa\rapidjam.configurator\EBWebView`. It is created on first launch and remains after the application ZIP is moved or deleted. Close the app before removing that directory to reset its WebView profile.
- Fixed Version WebView2 is not included in this build. A separate portable fixed-runtime configuration must be verified on supported Windows 10 targets before it can be promised.
