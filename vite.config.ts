import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveDevConfig } from './scripts/dev-config.mjs'

const devConfig = resolveDevConfig()

export default defineConfig({
  plugins: [react()],
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
