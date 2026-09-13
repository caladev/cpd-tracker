import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { unzipSync, strFromU8 } from 'fflate'
import { createDefaultData } from '../src/lib/defaults.js'

let root, app, data
beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cpd-api-tests-'))
  vi.stubEnv('CPD_DATA_DIR', root)
  // Import only after redirecting storage: never touch the shared iCloud DB.
  app = (await import('./index.mjs')).app
})
beforeEach(async () => {
  data = createDefaultData(new Date('2026-08-21T00:00:00Z'))
  data.trienniums.push({ id: 't-2023', label: '2023-2026', period: { start: '2023-07-01', end: '2026-06-30' } })
  data.entries = [
    { id: 'one', trienniumId: 't-2026', fy: 'FY27', title: 'Current course', hours: 2, status: 'Actual', verifiable: true, evidence: [] },
    { id: 'old', trienniumId: 't-2023', fy: 'FY24', title: 'Historic course', hours: 3, status: 'Draft', evidence: [] },
  ]
  await request(app).put('/api/data').send(data).expect(200)
})
afterAll(() => {
  vi.unstubAllEnvs()
  if (root) fs.rmSync(root, { recursive: true, force: true })
})

async function zip(includeEvidence) {
  const res = await request(app).get('/api/export/archive')
    .query({ trienniumId: 't-2026', includeEvidence: String(includeEvidence) })
    .buffer(true).parse((res, done) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => done(null, Buffer.concat(chunks)))
      res.on('error', done)
    }).expect(200)
  expect(res.headers['content-disposition']).toContain('.zip')
  return unzipSync(res.body)
}

describe('API regressions using isolated storage', () => {
  it('persists data, reports the storage/count and rejects malformed replacements', async () => {
    const info = await request(app).get('/api/info').expect(200)
    expect(info.body).toMatchObject({ dataDir: root, entryCount: 2, persisted: true })
    await request(app).put('/api/data').send({ entries: [] }).expect(400)
    const res = await request(app).get('/api/data').expect(200)
    expect(res.body.entries).toHaveLength(2)
    expect(res.body.serverNow).toBeTruthy()
    const stored = JSON.parse(fs.readFileSync(path.join(root, 'cpd_data.db'), 'utf8'))
    expect(stored.entries).toEqual(data.entries)
    expect(stored).not.toHaveProperty('serverNow')
  })
  it('uploads, reads and deletes evidence; rejects invalid upload types and destinations', async () => {
    const upload = await request(app).post('/api/upload').field('dest', 'evidence').field('key', 'one')
      .attach('file', Buffer.from('sample PDF'), 'certificate.pdf').expect(200)
    expect(upload.body.value).toMatch(/^evidence\/one\//)
    const file = path.join(root, upload.body.value)
    expect(fs.readFileSync(file, 'utf8')).toBe('sample PDF')
    await request(app).get('/api/file').query({ path: upload.body.value }).expect(200)
    await request(app).delete('/api/file').query({ path: upload.body.value }).expect(200)
    expect(fs.existsSync(file)).toBe(false)
    await request(app).delete('/api/file').query({ path: upload.body.value }).expect(404)
    await request(app).post('/api/upload').field('dest', 'evidence').expect(400)
    for (const [dest, key, filename] of [['bad', 'one', 'a.pdf'], ['evidence', '../../bad', 'a.pdf'], ['evidence', 'one', 'a.exe']]) {
      await request(app).post('/api/upload').field('dest', dest).field('key', key).attach('file', Buffer.from('test'), filename).expect(400)
    }
    const rules = await request(app).post('/api/upload').field('dest', 'rules').field('key', 'rs').attach('file', Buffer.from('rules'), 'rules.pdf').expect(200)
    expect(rules.body.value).toMatch(/^rules\//)
  })
  it('blocks traversal and handles absent evidence', async () => {
    for (const method of ['get', 'delete']) {
      await request(app)[method]('/api/file').query({ path: '../outside.pdf' }).expect(400)
      await request(app)[method]('/api/file').query({ path: 'evidence/missing.pdf' }).expect(404)
    }
  })
  it('scopes both CSV endpoints and rejects unknown trienniums and report names', async () => {
    for (const report of ['summary', 'detail']) {
      const res = await request(app).get(`/api/export/${report}`).query({ trienniumId: 't-2023' }).expect(200)
      expect(res.headers['content-type']).toContain('text/csv')
      expect(res.headers['content-disposition']).toContain('.csv')
      expect(res.text).toContain('2023-2026')
      expect(res.text).not.toContain('2026-2029')
      await request(app).get(`/api/export/${report}`).query({ trienniumId: 'unknown' }).expect(400)
    }
    await request(app).get('/api/export/nope').query({ trienniumId: 't-2026' }).expect(404)
  })
  it('produces readable ZIPs with only selected evidence flattened and duplicate names preserved', async () => {
    for (const folder of ['one', 'two', 'old']) {
      fs.mkdirSync(path.join(root, 'evidence', folder), { recursive: true })
      fs.writeFileSync(path.join(root, 'evidence', folder, 'certificate.pdf'), folder)
    }
    data.entries[0].evidence = ['one', 'two'].map((id) => ({ kind: 'file', value: `evidence/${id}/certificate.pdf` }))
    data.entries[1].evidence = [{ kind: 'file', value: 'evidence/old/certificate.pdf' }]
    await request(app).put('/api/data').send(data).expect(200)
    const reportsOnly = await zip(false)
    expect(Object.keys(reportsOnly)).toHaveLength(2)
    const files = await zip(true)
    expect(Object.keys(files).filter((name) => name.startsWith('evidence/'))).toEqual(['evidence/certificate.pdf', 'evidence/certificate-2.pdf'])
    expect(strFromU8(files['evidence/certificate.pdf'])).toBe('one')
    expect(strFromU8(files['evidence/certificate-2.pdf'])).toBe('two')
    const detail = strFromU8(files[Object.keys(files).find((name) => name.startsWith('cpd-detail'))])
    expect(detail).toContain('evidence/certificate-2.pdf')
    expect(detail).not.toContain('Historic course')
  })
})
