import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// the local Flask API — the dev and preview servers both proxy /api to it, so
// the browser sees one origin (no CORS needed locally)
const API = 'http://127.0.0.1:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': API }
  },
  preview: {
    proxy: { '/api': API }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{js,jsx}', 'src/main.jsx', 'src/isoCodes.js'],
      reporter: ['text', 'html', 'json-summary']
    }
  }
})
