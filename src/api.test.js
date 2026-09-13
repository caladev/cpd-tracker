import { afterEach, describe, expect, it, vi } from 'vitest'
import { getData, getInfo, saveData, uploadFile, deleteFile, assetUrl } from './api.js'

afterEach(() => vi.unstubAllGlobals())
describe('API client', () => {
  it('loads data and info, saves JSON, and encodes file references', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetch)
    await getData(); await getInfo(); await saveData({ entries: [] }); await deleteFile('evidence/a b+#.pdf')
    expect(fetch.mock.calls).toEqual([
      ['/api/data', {}], ['/api/info', {}],
      ['/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"entries":[]}' }],
      ['/api/file?path=evidence%2Fa%20b%2B%23.pdf', { method: 'DELETE' }],
    ])
    expect(assetUrl('evidence/a b+#.pdf')).toBe('/api/file?path=evidence%2Fa%20b%2B%23.pdf')
  })
  it('sends multipart uploads with their entry association', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ value: 'evidence/a.pdf' }) })
    vi.stubGlobal('fetch', fetch)
    const file = new File(['PDF'], 'a.pdf', { type: 'application/pdf' })
    await uploadFile(file, 'evidence', 'entry-one')
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/upload')
    expect(options.method).toBe('POST')
    expect(options.body.get('file').name).toBe('a.pdf')
    expect(options.body.get('dest')).toBe('evidence')
    expect(options.body.get('key')).toBe('entry-one')
  })
  it.each([['Permission denied', true, 'Permission denied'], [null, true, 'Request failed (500)'], [null, false, 'Request failed (500)']])('reports server errors (%s, JSON=%s)', async (error, json, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { if (!json) throw new Error(); return { error } } }))
    await expect(getData()).rejects.toThrow(expected)
  })
})
