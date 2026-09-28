# RapidJAM Configurator Plan

## Current Status

- [x] Standalone React/Vite configurator scaffold created.
- [x] MockTransport implemented for development without hardware.
- [x] App shell implemented: connection state, dirty state, Save, Discard.
- [x] Hall CH0-CH15 layout and physical labels added.
- [x] Hall defaults added from the current RapidJAM settings:
  - ADC: GPIO29
  - Multiplexer: 16 channels
  - Select pins: GPIO13, GPIO14, GPIO15, GPIO26
  - Idle: 2350
  - Active: 2450, except CH13: 2700
  - Pressed: 3100
  - Rapid Trigger threshold: 2800
  - Noise filter: 30
  - Polarity: N
- [x] User-adjusted approximate Hall button coordinates are stored in `src/styles.css`.
- [x] GPIO configuration is limited to GP0-GP5.
- [x] Current GPIO defaults added:
  - GP0: S2
  - GP1: A1
  - GP2: Menu Down
  - GP3: Menu Select
  - GP4: Menu Back
  - GP5: Fn
- [x] GPIO assignment choices added for standard actions, Turbo, Macro, Accelerator, Brake, Home, Menu actions, and Fn.
- [x] Production build passes with `npm run build`.
- [x] Refactor Phase 1 started: shared constants, calibration types, and pure calibration math modules added without changing runtime behavior.
- [x] Refactor Phase 2 started: controller and setting-input renderers extracted into `src/components/` without moving state or transport logic.
- [x] Extract `MappingPanel` into `src/components/MappingPanel.tsx`; App retains only callbacks and state ownership.
- [x] Extract `HallPanel` into `src/components/HallPanel.tsx`; calibration state remains owned by App for now.
- [x] Extract `CalibrationWorkspace` and `CalibrationPanel` into `src/components/CalibrationWorkspace.tsx`; timing and state ownership remain in App.
- [x] Remove the duplicated inline Hall/calibration renderers from App; App now composes extracted presentation components.
- [x] Add `src/transport/createTransport.ts` and remove direct Mock/HTTP transport selection from App.
- [x] Add `useDeviceConfig.ts` for connection, config snapshots, dirty state, save/discard, restart, preview, and Hall calibration persistence.
- [x] Add the initial `useHallCalibration.ts` state/buffer boundary; async loop integration remains the next refactor slice.
- [x] Connect App calibration state and mutable buffers to `useHallCalibration`; the existing loop remains temporarily in App for behavior preservation.
- [x] Move the active baseline/capture polling loop into `useHallCalibration`; App no longer starts the legacy loop.
- [x] Centralize complete/skip-to-review detection in `useHallCalibration` and check it after each channel/pass.
- [x] Remove the transitional dead calibration functions, refs, loops, and setter aliases from App; `useHallCalibration` is now the single calibration owner.

## Phase 1 HTTP Integration

1. [x] Add selectable `HttpTransport` for a real RapidJAM at `http://192.168.7.1`. Use `?transport=http` in the app URL.
2. [x] Implement `getPinMappings` and `setPinMappings` mapping between GP2040-CE JSON and the app's GP0-GP5 model.
3. [x] Implement `getHETriggerCalibrations` and `setHETriggerCalibrations` mapping for CH0-CH15.
4. [ ] Implement `getHETriggerVoltage` for live Hall signal display.
5. [x] Add request logging, network error context, and a visible connection diagnostic for unreachable devices. More granular firmware/value errors remain.
6. [ ] Verify save with a readback on physical hardware. The current GP2040 endpoints save immediately, so preview is local until commit.
7. [x] Test with the physical RapidJAM in WebConfig/RNDIS mode through the VS Code browser. Firmware and Hall/GPIO reads succeeded.

### HTTP test procedure

1. Start the configurator with `npm run dev`.
2. Put RapidJAM into WebConfig/RNDIS mode and confirm `http://192.168.7.1/` opens in the browser.
3. Open `http://127.0.0.1:5174/?transport=http`.
4. Confirm the header shows the firmware version and the GPIO/Hall values match WebConfig.
5. Change one GPIO assignment or one Hall setting, then use `Save to device`.
6. Reconnect or power-cycle RapidJAM and confirm the value remains after reloading the configurator.

The HTTP adapter currently preserves the API's raw Hall calibration values and converts the UI's 0.0-1.5 mm values to ADC thresholds using each channel's idle and pressed values. Turbo/Macro/standard actions with known GP2040 enum values are supported. Assignments without a matching GP2040 GPIO enum are rejected rather than silently written.

## Hall Calibration Implementation

- [x] Add HTTP transport methods for per-channel voltage reads; calibration reapplies the known RapidJAM MUX setup and waits 1500ms for ADC settling.
- [x] Add automatic all-channel idle sampling with up to 30 attempts per voltage read at 50ms intervals.
- [x] Add unordered full-press capture with automatic channel completion.
- [x] Add dedicated calibration progress view with physical layout, per-channel status, and collapsible raw result table.
- [x] Add clickable failed channels for individual retry without rerunning successful channels.
- [x] Apply valid results to the local draft only; durable storage remains `Save to device`.
- [ ] Validate the full capture flow on physical RapidJAM. The configurator now retries ADC29 reads up to four times per channel; channels that still fail remain visible as errors instead of aborting the entire run.

### Firmware prerequisite discovered

The shipped `v0.7.12-48-g<fw-commit>-dirty` firmware returns a failed/empty response when `getHETriggerVoltage` targets RapidJAM's ADC29, while the same endpoint works with ADC28. The GP2040-CE ADC upper-bound checks excluded the final valid ADC GPIO. The following firmware files now include the boundary fix; the RapidJAM firmware must be rebuilt and flashed before automatic calibration can work against ADC29:

- `../GP2040-CE/src/webconfig.cpp`
- `../GP2040-CE/src/addons/he_trigger.cpp`

## Known Limitations

- The browser UI defaults to MockTransport; use `?transport=http` with the legacy local server for real hardware. The Tauri app selects the native HTTP bridge automatically.
- `HttpTransport` has GP2040-CE JSON mappings for the configurator's supported fields; its multiple POST save operations are not transactional and require release-grade recovery/real-device tests.
- Hall position values are converted to ADC thresholds using per-channel idle/pressed calibration data.
- Some GPIO choices without a supported GP2040-CE action mapping are rejected instead of silently written.
- GPIO physical positions remain approximate and are not currently rendered as separate physical buttons.
- WebHID and a custom firmware protocol are Phase 2 and are not required for the HTTP/WebConfig integration.

## Planned: Independent Rapid Trigger Controls

### Design

- `HallSetting.release` is the existing Rapid Trigger Threshold value sent as `triggers[i].release`. It remains the normal `Release point` control when Rapid Trigger is disabled and is relabeled `Rapid Trigger Threshold` when Rapid Trigger is enabled.
- `HallSetting.noise` already round-trips unchanged through `HttpTransport` and `MockTransport`, but is not currently exposed in the RapidJAM UI.
- `noise` is an ADC delta, not a position. The UI must edit it as a raw integer from 0 to 4095 and must not use the millimeter conversion used by `release`.
- Both Rapid Trigger controls are shown only when Rapid Trigger is enabled. The existing `Release point` remains visible when it is disabled.

### TODO

- [x] Relabel the existing release slider based on Rapid Trigger state.
- [x] Add an integer input for `HallSetting.noise` with a 0-4095 range.
- [x] Preserve the existing HTTP/API mapping without firmware changes.
- [x] Build and manually verify the RT-enabled and RT-disabled control sets.
- [ ] Verify Noise Filter readback and save persistence on physical RapidJAM hardware.

## Tauri Desktop Migration (Windows x64)

### Implemented groundwork

- [x] Add Tauri v2 API/CLI dependencies and Tauri development/build scripts.
- [x] Keep the existing browser `HttpTransport`/Vite proxy and select a native Tauri request path only inside the desktop webview.
- [x] Add a Rust HTTP bridge restricted to explicit WebConfig endpoints, the `192.168.7.1` device host, GET/POST pairs, JSON object bodies, response/request size limits, timeouts, no redirects, and the main configurator window.
- [x] Embed the Vite production assets in the Tauri app and store WebView data under `%LOCALAPPDATA%\Goppa\rapidjam.configurator\EBWebView`.
- [x] Remove the remote Google Fonts import so the bundled UI does not need an internet connection for styling.
- [x] Add a Windows x64 no-installer ZIP build script and document the current Evergreen WebView2 dependency.

### TODO / acceptance gate

- [x] Install/verify the Rust stable MSVC toolchain and Windows C++ Build Tools on the build machine; generate `src-tauri/Cargo.lock`.
- [x] Run `npm run build`, `cargo test --locked`, and the Windows x64 release ZIP build; Rust unit tests pass (4/4, including request-body type/size validation).
- [x] Inspect the rebuilt ZIP and confirm it contains the EXE and `WebView2Loader.dll`; app starts with Evergreen WebView2 and stores the profile under `%LOCALAPPDATA%\Goppa\rapidjam.configurator\EBWebView`.
- [x] Run `npm ci`, `npm run build`, and the release metadata check after exact-pinning dependencies.
- [ ] Run `npm run tauri:dev` interactively.
- [ ] Confirm WebView2 Evergreen presence/version and update policy with the recipient before delivery. Windows 11 normally includes it; some managed/older Windows 10 systems may not.
- [ ] Decide whether to build a separate Fixed Version WebView2 package for any target lacking Evergreen. The current ZIP does not contain it; do not claim support until runtime path, ACLs, writable local extraction and offline launch are verified on Windows 10/11.
- [ ] Test on clean Windows 10 and 11 x64 machines with WebView2 installed, including an offline launch. Current smoke test was on the development PC with Evergreen WebView2 153.0.4234.48.
- [x] Smoke-test WebView2 profile creation under `%LOCALAPPDATA%` and verify the process uses the configured Goppa path.
- [ ] Test non-admin offline start from local paths containing spaces/Japanese characters and behavior with read-only application folders.
- [x] Unit-test allowed WebConfig method/path pairs, rejection of unknown paths/methods, and request-body type/size validation.
- [ ] Verify timeout/oversize responses and read, save/readback, reboot and Hall voltage capture on physical hardware.
- [ ] Code-sign or agree SmartScreen handling before delivery; record ZIP SHA-256 and maintain an Evergreen/WebView2 support/update checklist.

## Parallel VS Code Development Isolation

Keep each worktree's development processes separate from other VS Code instances. Run `npm run dev:setup -- --base-port <unused-port>` once per worktree; the generated `.env.local` is ignored by Git. The physical RapidJAM at `192.168.7.1` remains a shared resource.

### Implemented

- [x] Add `npm run dev:setup -- --base-port <port>` and `npm run dev:show`; store per-worktree settings in ignored `.env.local` with distinct dev, legacy, and preview ports plus a unique development profile.
- [x] Resolve Vite/preview and parallel legacy server ports from the per-worktree settings, while preserving strict port binding and the packaged launcher's 5173 default.
- [x] Generate an ignored Tauri dev override so the dev URL/CSP/profile and Rust debug IPC allowlist use the same selected port; keep production Tauri configuration independent of local settings.
- [x] Document the setup workflow and shared physical-device caveat in `DISTRIBUTION.md` and `src-tauri/README.md`.

### TODO / verification

- [x] Run `npm run dev:setup -- --base-port 5174` in this worktree, confirm 5174/5175/5176 availability, and ensure `.env.local` and generated Tauri override remain ignored.
- [ ] Confirm other VS Code instances use distinct `.env.local` assignments; do not stop or repurpose their ports.
- [x] Test `npm run dev:show`, config validation failures, process-environment overrides, and `--force` regeneration.
- [x] Run `npm run build` successfully after the port/config changes.
- [x] Run `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml`; formatting passes and all 5 Rust tests pass with the configured port.
- [x] Confirm the installed stable MSVC toolchain/target, Visual Studio C++ Build Tools, Windows SDK, Node/npm, and `cargo-about 0.9.2`; add `%USERPROFILE%\.cargo\bin` to PATH for this PowerShell session only because that directory is absent from the process PATH.
- [x] Normalize CRLF when reading `Cargo.lock` in the release metadata check; `npm run release:check` now passes without changing the lockfile.
- [x] Build the Rust app for `x86_64-pc-windows-msvc` with `cargo build --locked --offline --release`; the executable was generated under `src-tauri/target/`.
- [x] Run `npm run tauri:build -- --target x86_64-pc-windows-msvc --no-bundle`; the complete Windows x64 Tauri executable builds successfully.
- [x] Start Vite, preview, and the parallel legacy server individually; verified HTTP 200 and loopback-only listeners on configured ports 5174, 5176, and 5175.
- [ ] Start Tauri in development mode and verify its effective merged development config, HMR, dev-only WebView2 profile, and IPC origin checks; release build was verified, but no development GUI was launched.
- [x] Confirm setup rejects an occupied port with `EADDRINUSE` without modifying existing settings; Vite/preview retain strict port behavior.
- [x] Confirm the generated Tauri dev config matches `.env.local` and tracked release config still points at `%LOCALAPPDATA%\Goppa\rapidjam.configurator`.
- [ ] Coordinate real-device operations; back up current RapidJAM settings before writes, verify readback and restore the original values. Use Mock transport while the other work is using the controller.
- [ ] Keep builds in separate checkouts; never run concurrent builds against the same `dist/`, `src-tauri/target/`, or `release/` directory.

## Phase 2: Dedicated USB Configuration

Only proceed after confirming that RapidJAM firmware can be modified and distributed.

1. Add a separate vendor-defined HID configuration interface.
2. Define a versioned framed protocol with command, transaction ID, chunks, payload length, and CRC/error handling.
3. Implement WebHidTransport behind the existing transport interface.
4. Validate reconnects, permission denial, interrupted transfers, old firmware, concurrent game input, and PS4/PS5 modes.

## Relevant Files

- `src/App.tsx`: UI, screens, Save/Discard flow, GPIO and Hall controls.
- `src/device.ts`: configuration types, defaults, MockTransport, mapped HttpTransport, and Tauri IPC request adapter.
- `src/styles.css`: layout, physical button coordinates, circular button styling.
- `src-tauri/tauri.conf.json`: embedded frontend, window security/CSP, and portable data directory.
- `src-tauri/src/lib.rs`: Rust WebConfig HTTP bridge and API allowlist.
- `src-tauri/about.toml` / `src-tauri/about.hbs`: Windows x64 third-party Rust license audit policy/template; generated notices require human review.
- `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock`: locked native dependencies.
- `build-tauri-distribution.ps1`: Windows x64 executable ZIP and SHA-256 generation.
- `DISTRIBUTION.md`: Tauri and legacy browser distribution requirements.
- `../docs/button_layout.txt`: RapidJAM channel and GPIO assignment reference.
- `../docs/RapidJAM_addons_settings.txt`: RapidJAM Hall/MUX settings reference.
- `../GP2040-CE/src/webconfig.cpp`: firmware HTTP endpoint implementation.
- `../GP2040-CE/www/src/Services/WebApi.js`: existing request and response shapes.
- `../GP2040-CE/proto/config.proto`: persistent configuration schema.

## Verification Checklist

- [ ] Read current configuration from a real device.
- [ ] Change one GP0-GP5 assignment and preview it.
- [ ] Discard the change and confirm the device returns to the saved value.
- [ ] Save the change and confirm it after power cycling.
- [ ] Read CH0-CH15 Hall values.
- [ ] Change one Hall threshold and confirm the result in-game.
- [ ] Confirm CH13's different active threshold is preserved.
- [ ] Confirm failed saves retain the draft and show an error.
- [ ] Confirm WebConfig remains usable as a recovery path.
