import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  dataPaths,
  sanitizeFilename,
  uploadFilename,
  sanitizeId,
  resolvePathIn,
  validateData,
  normalizeData,
  validateEntry,
  writeDataAtomically,
  loadData,
} from './lib.mjs'
import { createDefaultData, createDefaultRulesets } from '../src/lib/defaults.js'

let tmpDir

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpd-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('paths', () => {
  it('lays out the data store', () => {
    const p = dataPaths('/x')
    expect(p.dbFile.endsWith('cpd_data.db')).toBe(true)
    expect(p.evidenceDir.endsWith('evidence')).toBe(true)
    expect(p.rulesDir.endsWith('rules')).toBe(true)
  })

  it('blocks path traversal outside the root', () => {
    expect(resolvePathIn('/root', 'evidence/x.pdf')).toBe('/root/evidence/x.pdf')
    expect(resolvePathIn('/root', '../secret')).toBeNull()
    expect(resolvePathIn('/root', '/etc/passwd')).toBeNull()
    expect(resolvePathIn('/root', '')).toBeNull()
    expect(resolvePathIn('/root', 42)).toBeNull()
  })
})

describe('filename sanitisation', () => {
  it('strips directories and unsafe characters', () => {
    expect(sanitizeFilename('../../etc/passwd')).toEqual(expect.not.stringContaining('/'))
    expect(sanitizeFilename('my cert.pdf')).toBe('my_cert.pdf')
    expect(sanitizeFilename('')).toBe('')
  })

  it('accepts images/PDFs only', () => {
    expect(uploadFilename('report.pdf')).toMatch(/^\d+-report\.pdf$/)
    expect(uploadFilename('photo.PNG')).toMatch(/\.PNG$/)
    expect(uploadFilename('notes.txt')).toBeNull()
    expect(uploadFilename('script.sql')).toBeNull()
  })
})

describe('id sanitisation', () => {
  it('accepts ids and rejects junk', () => {
    expect(sanitizeId('9f3a0f2e-1d99')).toBe('9f3a0f2e-1d99')
    expect(sanitizeId('../../x')).toBeNull()
    expect(sanitizeId('a'.repeat(200))).toBeNull()
  })
})

describe('validation + normalisation', () => {
  it('accepts the default dataset', () => {
    const data = createDefaultData(new Date('2026-08-14T10:00:00Z'))
    expect(validateData(data)).toBe(true)
    expect(normalizeData(data)).not.toBeNull()
    expect(data.trienniums[0].label).toBe('2026-2029')
    expect(data.rulesets[0].targets.ethicsVerifiablePerTriennium).toBe(6)
  })

  it('rejects malformed payloads', () => {
    expect(validateData(null)).toBe(false)
    expect(validateData({})).toBe(false)
    expect(validateData({ trienniums: [], rulesets: [{}], exemptions: [], entries: [] })).toBe(false)
  })

  it('drops invalid entries on normalise', () => {
    const data = createDefaultData()
    data.entries = [
      { id: 'good', status: 'Actual', title: 'x', hours: 1 },
      { id: 'bad', status: 'What', title: 'y', hours: 1 },
      { id: 'neg', status: 'Actual', title: 'z', hours: -5 },
    ]
    const clean = normalizeData(data)
    expect(clean.entries.map((e) => e.id)).toEqual(['good'])
    expect(validateEntry({ status: 'Draft', id: 'x', title: 't', hours: 2 })).toBe(true)
    expect(validateEntry({})).toBe(false)
  })

  it('round-trips through validate/normalize', () => {
    const data = createDefaultData()
    data.entries.push({ id: 'e', status: 'Actual', title: 'T', hours: 1.5 })
    const clean = normalizeData(data)
    expect(validateData(clean)).toBe(true)
  })

  it('strips runtime-only fields such as serverNow so they never persist', () => {
    const data = createDefaultData()
    data.serverNow = '2026-08-14T00:37:41.606Z'
    data._path = '/etc/passwd'
    const clean = normalizeData(data)
    expect(clean).not.toHaveProperty('serverNow')
    expect(clean).not.toHaveProperty('_path')
    expect(JSON.stringify(clean)).not.toContain('serverNow')
    expect(validateData(clean)).toBe(true)
  })
})

describe('atomic persistence', () => {
  it('writes and reads back a file', () => {
    const db = path.join(tmpDir, 'cpd_data.db')
    const data = createDefaultData()
    writeDataAtomically(db, data)
    expect(fs.existsSync(db)).toBe(true)
    const loaded = loadData(db, tmpDir)
    expect(loaded.trienniums).toHaveLength(1)
    expect(JSON.parse(fs.readFileSync(db, 'utf8')).version).toBe(1)
  })

  it('seeds defaults when the file is missing or corrupt', () => {
    const missing = loadData(path.join(tmpDir, 'nope.db'), tmpDir)
    expect(missing.rulesets[0].label).toContain('CR 7')
    const db = path.join(tmpDir, 'bad.db')
    fs.writeFileSync(db, '{not json', 'utf8')
    const corrupt = loadData(db, tmpDir)
    expect(corrupt.entries).toHaveLength(0)
  })
})

describe('defaults', () => {
  it('ships one current ruleset with CR 7 numbers', () => {
    const rs = createDefaultRulesets()
    expect(rs).toHaveLength(1)
    expect(rs[0].targets).toMatchObject({
      annualMinCpd: 20,
      trienniumMinCpd: 120,
      trienniumVerifiable: 90,
      ethicsVerifiablePerTriennium: 6,
    })
  })
})