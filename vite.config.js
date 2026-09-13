import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 39889,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:39890'
    }
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{js,jsx}', 'server/**/*.mjs'],
      exclude: ['**/*.test.*', 'src/main.jsx', 'src/components/Icons.jsx', 'server/stop-dev.mjs'],
      thresholds: {
        statements: 95, lines: 95, branches: 80, functions: 83,
      },
    },
    environment: 'node',
    include: ['src/**/*.test.js', 'server/**/*.test.mjs']
  }
})
