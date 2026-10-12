import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveDevConfig } from './scripts/dev-config.mjs'
import { parseButtonFaceTuningFile } from './src/config/buttonFaceTuningValidation.ts'

const devConfig = resolveDevConfig()
const BUTTON_FACE_TUNING_PATH = fileURLToPath(new URL('./src/config/buttonFaceTuning.json', import.meta.url))
const BUTTON_FACE_TUNING_ENDPOINT = '/__button-face-tuning'
const MAX_BODY_BYTES = 64 * 1024

function sendJson(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function buttonFaceTuningWriter(): Plugin {
  return {
    name: 'button-face-tuning-writer',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(BUTTON_FACE_TUNING_ENDPOINT, (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'method not allowed' })
          return
        }
        const chunks: Buffer[] = []
        let size = 0
        let rejected = false
        req.on('data', (chunk: Buffer) => {
          if (rejected) return
          size += chunk.length
          if (size > MAX_BODY_BYTES) {
            rejected = true
            sendJson(res, 413, { error: 'payload too large' })
            req.destroy()
            return
          }
          chunks.push(chunk)
        })
        req.on('end', () => {
          if (rejected) return
          let input: unknown
          try {
            input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          } catch {
            sendJson(res, 400, { error: 'invalid JSON' })
            return
          }
          const result = parseButtonFaceTuningFile(input)
          if (!result.ok) {
            sendJson(res, 422, { error: result.error })
            return
          }
          const text = `${JSON.stringify(result.value, null, 2)}\n`.replace(/\r?\n/g, '\r\n')
          writeFileSync(BUTTON_FACE_TUNING_PATH, text, 'utf8')
          sendJson(res, 200, { ok: true })
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), buttonFaceTuningWriter()],
  server: {
    host: '127.0.0.1',
    port: devConfig.devPort,
    strictPort: true,
    watch: {
      ignored: ['**/release/**'],
    },
    proxy: {
      '/rapidjam-api': {
        target: 'http://192.168.7.1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rapidjam-api/, ''),
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: devConfig.previewPort,
    strictPort: true,
  },
})
