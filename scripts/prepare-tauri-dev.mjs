import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveDevConfig } from './dev-config.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const config = resolveDevConfig({ root })
const tauriConfigPath = resolve(root, 'src-tauri/tauri.conf.json')
const generatedConfigPath = resolve(root, 'src-tauri/tauri.dev.local.conf.json')
const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf8'))
const baseDevCsp = tauriConfig.app.security.devCsp
const devCsp = baseDevCsp
  .replace(/http:\/\/127\.0\.0\.1:\d+/g, `http://127.0.0.1:${config.devPort}`)
  .replace(/ws:\/\/127\.0\.0\.1:\d+/g, `ws://127.0.0.1:${config.devPort}`)

const generated = {
  build: {
    beforeDevCommand: `npm run dev -- --host 127.0.0.1 --port ${config.devPort} --strictPort`,
    devUrl: `http://127.0.0.1:${config.devPort}`,
  },
  app: {
    appDirectoriesOverride: {
      localData: `$LOCALDATA/Goppa/${config.profile}`,
    },
    security: { devCsp },
  },
}

writeFileSync(generatedConfigPath, `${JSON.stringify(generated, null, 2)}\n`, 'utf8')
console.log(`Generated ignored Tauri dev config: ${generatedConfigPath}`)
