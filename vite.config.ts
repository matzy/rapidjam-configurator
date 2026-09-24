import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
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
})
