import { expect, it } from 'vitest'
import fs from 'node:fs'
import config from '../vite.config.js'

it('keeps the phone-facing UI and API proxy on the agreed development ports', () => {
  expect(config.server).toMatchObject({ host: '0.0.0.0', port: 39889, strictPort: true })
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const apiPort = Number(pkg.scripts['dev:api'].match(/PORT=(\d+)/)[1])
  expect(apiPort).toBe(39890)
  expect(new URL(config.server.proxy['/api']).port).toBe(String(apiPort))
  expect(pkg.scripts['dev:fresh']).toBe('npm run dev:stop && npm run dev')
})
