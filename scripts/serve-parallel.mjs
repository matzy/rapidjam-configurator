import { resolveDevConfig } from './dev-config.mjs'

if (!process.env.PORT && !process.env.RAPIDJAM_SERVE_PORT) {
  process.env.RAPIDJAM_SERVE_PORT = String(resolveDevConfig().servePort)
}

await import('../server.mjs')
