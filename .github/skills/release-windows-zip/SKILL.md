---
name: release-windows-zip
description: Prepare and publish a Windows ZIP release of RapidJAM Configurator through the tag-triggered GitHub Actions workflow. Use when the user asks to release, tag, publish, or cut a new version (for example v0.7.0).
---

# Release the Windows ZIP

The full procedure is in [DISTRIBUTION.md](../../../DISTRIBUTION.md) under "Release via GitHub Actions". Follow it. This skill is the checklist and run order.

## Checklist

1. Confirm the version is bumped in `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`. Run `npm run release:check`.
2. Write `docs/release-notes/v<version>.md` in English first, then Japanese. The workflow reads this file for the draft Release.
3. Run the tests: `npm run test:*` (see `package.json`).
4. Scan staged changes for personal or sensitive information before committing.
5. Commit on the release branch. Push the branch, then create and push the tag `v<version>` on that commit.
6. Wait for the "Release" workflow. Check that the version check, tests, and ZIP build succeed.
7. Check the draft Release: the ZIP and `rapidjam-configurator-x64-<version>.zip.sha256` are attached, and the notes are correct. Publish it manually.

## Pitfalls

- The tag must match the version in `package.json`, or the workflow stops.
- If a draft for the tag already exists, delete it before re-running. Otherwise the Release step fails.
- Deleting or moving a tag starts a new full build (about 12 minutes).
- Attestations run only when the repository is public. While it is private, the attest steps are skipped and the workflow still succeeds.
- Do not commit `local-file-app/` or other local-only build output.
