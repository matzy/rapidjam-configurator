import { createServer } from 'node:net'
import { createHash } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const args = process.argv.slice(2)
let basePort
let force = false

for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--base-port') {
    basePort = args[index + 1]
    index += 1
  } else if (args[index] === '--force') {
    force = true
  } else {
    throw new Error(`Unknown option: ${args[index]}`)
  }
}

if (!/^\d+$/.test(String(basePort ?? ''))) {
  throw new Error('Usage: npm run dev:setup -- --base-port <port> [--force]')
}
basePort = Number(basePort)
if (!Number.isSafeInteger(basePort) || basePort < 1 || basePort > 65533) {
  throw new Error('The base port must be between 1 and 65533 so all three ports fit in the valid range.')
}

const ports = [basePort, basePort + 1, basePort + 2]
const configPath = resolve(root, '.env.local')
if (existsSync(configPath) && !force) {
  throw new Error('.env.local already exists. Use npm run dev:show, or pass --force to replace it.')
}

function canBind(port) {
  return new Promise((resolveBind, rejectBind) => {
    const server = createServer()
    server.once('error', (error) => rejectBind(new Error(`Port ${port} is unavailable on 127.0.0.1 (${error.code}). Choose another base port.`)))
    server.listen(port, '127.0.0.1', () => server.close((error) => {
      if (error) rejectBind(error)
      else resolveBind()
    }))
  })
}

for (const port of ports) await canBind(port)

const worktreeName = basename(root).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z0-9]+/, '').slice(0, 32) || 'worktree'
const worktreeHash = createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 8)
const profile = `rapidjam-${worktreeName}-${worktreeHash}`
const contents = [
  '# Worktree-local development settings. This file is ignored by Git.',
  `RAPIDJAM_DEV_PORT=${ports[0]}`,
  `RAPIDJAM_SERVE_PORT=${ports[1]}`,
  `RAPIDJAM_PREVIEW_PORT=${ports[2]}`,
  `RAPIDJAM_DEV_PROFILE=${profile}`,
  '',
].join('\n')

writeFileSync(configPath, contents, { encoding: 'utf8', flag: force ? 'w' : 'wx' })
console.log(`Configured worktree-local settings at ${configPath}`)
console.log(`Vite/Tauri: ${ports[0]}, legacy server: ${ports[1]}, preview: ${ports[2]}`)
console.log(`Tauri development profile: ${profile}`)
console.log('Run npm run dev:show to review the effective settings.')
