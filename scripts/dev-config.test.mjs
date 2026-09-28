import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { resolveDevConfig } from './dev-config.mjs'

function withRoot(run) {
  const root = mkdtempSync(join(tmpdir(), 'rapidjam-dev-config-'))
  try {
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('uses non-conflicting standalone defaults when no local config exists', () => {
  withRoot((root) => {
    assert.deepEqual(resolveDevConfig({ root, env: {} }), {
      devPort: 5173,
      servePort: 5174,
      previewPort: 5175,
      profile: 'rapidjam-configurator-dev',
    })
  })
})

test('loads per-worktree settings and lets process environment override them', () => {
  withRoot((root) => {
    writeFileSync(join(root, '.env.local'), [
      'RAPIDJAM_DEV_PORT=5180',
      'RAPIDJAM_SERVE_PORT=5181',
      'RAPIDJAM_PREVIEW_PORT=5182',
      'RAPIDJAM_DEV_PROFILE=rapidjam-dev-feature-a',
    ].join('\r\n'))

    assert.deepEqual(resolveDevConfig({ root, env: { RAPIDJAM_DEV_PORT: '5190' } }), {
      devPort: 5190,
      servePort: 5181,
      previewPort: 5182,
      profile: 'rapidjam-dev-feature-a',
    })
  })
})

test('rejects invalid, duplicate ports and unsafe profile names', () => {
  withRoot((root) => {
    assert.throws(() => resolveDevConfig({ root, env: { RAPIDJAM_DEV_PORT: '70000' } }), /RAPIDJAM_DEV_PORT/)
    assert.throws(() => resolveDevConfig({ root, env: { RAPIDJAM_DEV_PORT: '5173', RAPIDJAM_SERVE_PORT: '5173' } }), /must all be different/)
    assert.throws(() => resolveDevConfig({ root, env: { RAPIDJAM_DEV_PROFILE: '../other' } }), /path-safe/)
  })
})
