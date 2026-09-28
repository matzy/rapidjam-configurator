import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULTS = Object.freeze({
  devPort: 5173,
  servePort: 5174,
  previewPort: 5175,
  profile: 'rapidjam-configurator-dev',
})

const KEYS = Object.freeze({
  RAPIDJAM_DEV_PORT: 'devPort',
  RAPIDJAM_SERVE_PORT: 'servePort',
  RAPIDJAM_PREVIEW_PORT: 'previewPort',
  RAPIDJAM_DEV_PROFILE: 'profile',
})

function parseLocalEnv(root) {
  let text
  try {
    text = readFileSync(resolve(root, '.env.local'), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }

  const values = {}
  for (const [index, rawLine] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) throw new Error(`Invalid .env.local entry on line ${index + 1}`)
    const key = line.slice(0, separator).trim()
    if (!Object.hasOwn(KEYS, key)) continue
    let value = line.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }
  return values
}

function parsePort(key, value) {
  if (!/^\d+$/.test(String(value))) throw new Error(`${key} must be an integer port from 1 to 65535`)
  const port = Number(value)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${key} must be an integer port from 1 to 65535`)
  }
  return port
}

export function resolveDevConfig({ root = process.cwd(), env = process.env } = {}) {
  const local = parseLocalEnv(root)
  const values = Object.fromEntries(Object.entries(KEYS).map(([key, property]) => [
    property,
    env[key] ?? local[key] ?? DEFAULTS[property],
  ]))

  const config = {
    devPort: parsePort('RAPIDJAM_DEV_PORT', values.devPort),
    servePort: parsePort('RAPIDJAM_SERVE_PORT', values.servePort),
    previewPort: parsePort('RAPIDJAM_PREVIEW_PORT', values.previewPort),
    profile: String(values.profile),
  }

  if (new Set([config.devPort, config.servePort, config.previewPort]).size !== 3) {
    throw new Error('Development, legacy server, and preview ports must all be different')
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(config.profile)) {
    throw new Error('RAPIDJAM_DEV_PROFILE must be a 1-64 character path-safe name')
  }
  return config
}

export function formatDevConfig(config) {
  return [
    `Vite/Tauri: http://127.0.0.1:${config.devPort}`,
    `Legacy server: http://127.0.0.1:${config.servePort}/?transport=http`,
    `Preview: http://127.0.0.1:${config.previewPort}`,
    `Tauri dev profile: %LOCALAPPDATA%\\Goppa\\${config.profile}\\EBWebView`,
  ].join('\n')
}
