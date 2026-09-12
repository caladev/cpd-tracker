import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { detailCsv, evidenceFilesForExport, exportDate, summaryCsv } from './export.mjs'
import { currentExportTriennium, scopeExport } from '../src/lib/exportScope.js'

const data = {
  trienniums: [{ id: 't-2026', label: '2026-2029' }],
  entries: [
    {
      id: 'one',
      trienniumId: 't-2026',
      fy: 'FY27',
      status: 'Actual',
      date: '2026-08-21',
      title: 'Ethics, workshop',
      provider: 'CA ANZ',
      hours: 2,
      verifiable: true,
      ethicsHours: 2,
      onTheJob: false,
      relevance: 'Yes',
      specialisation: false,
      notes: 'Completed',
      evidence: [{ kind: 'file', value: 'evidence/one/certificate.pdf', filename: 'certificate.pdf' }],
    },
    {
      id: 'two',
      trienniumId: 't-2026',
      fy: 'FY27',
      status: 'Draft',
      title: 'Reading',
      hours: 1.5,
      verifiable: false,
      ethicsHours: 0,
      onTheJob: true,
      evidence: [{ kind: 'url', value: 'https://example.com/article' }],
    },
  ],
}

describe('export reports', () => {
  it('defaults to the date-based triennium and filters explicitly selected periods', () => {
    const periods = [
      { id: 'old', period: { start: '2023-07-01', end: '2026-06-30' } },
      { id: 'current', period: { start: '2026-07-01', end: '2029-06-30' } },
    ]
    expect(currentExportTriennium(periods, new Date('2026-06-30T15:00:00Z'))).toBe('current')
    expect(currentExportTriennium(periods, new Date('2026-06-30T12:00:00Z'))).toBe('old')
    const source = { trienniums: periods, entries: [{ trienniumId: 'old' }, { trienniumId: 'current' }] }
    expect(scopeExport(source, 'old').entries).toEqual([{ trienniumId: 'old' }])
    expect(() => scopeExport(source, 'unknown')).toThrow('Select a valid triennium')
  })
  it('creates a summary grouped by financial year and status', () => {
    const report = summaryCsv(data)
    expect(report).toContain('Triennium,Financial Year,Status,Entries,CPD Hours')
    expect(report).toContain('2026-2029,FY27,Actual,1,2,2,0,2,0')
    expect(report).toContain('2026-2029,FY27,Draft,1,1.5,0,1.5,0,1.5')
  })

  it('creates an escaped detail report with evidence references', () => {
    const report = detailCsv(data)
    expect(report).toContain('"Ethics, workshop"')
    expect(report).toContain('certificate.pdf')
    expect(report).toContain('https://example.com/article')
  })

  it('uses a stable date in filenames', () => {
    expect(exportDate(new Date('2026-09-12T10:00:00Z'))).toBe('2026-09-12')
    expect(exportDate(new Date('2026-09-11T20:00:00Z'))).toBe('2026-09-12')
  })

  it('includes only referenced evidence files within the evidence directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cpd-export-'))
    const evidenceDir = path.join(root, 'evidence')
    fs.mkdirSync(path.join(evidenceDir, 'one'), { recursive: true })
    fs.writeFileSync(path.join(evidenceDir, 'one', 'certificate.pdf'), 'test')
    fs.mkdirSync(path.join(evidenceDir, 'two'))
    fs.writeFileSync(path.join(evidenceDir, 'two', 'certificate.pdf'), 'second')
    fs.writeFileSync(path.join(root, 'outside.pdf'), 'outside')
    try {
      const files = evidenceFilesForExport(
        {
          entries: [
            {
              evidence: [
                { kind: 'file', value: 'evidence/one/certificate.pdf' },
                { kind: 'file', value: 'evidence/two/certificate.pdf' },
                { kind: 'file', value: 'evidence/one/certificate.pdf' },
                { kind: 'file', value: '../outside.pdf' },
              ],
            },
          ],
        },
        root,
        evidenceDir,
      )
      expect(files.map((file) => file.name)).toEqual(['evidence/certificate.pdf', 'evidence/certificate-2.pdf'])
      const names = new Map(files.map((file) => [file.reference, file.name]))
      expect(detailCsv(data, names)).toContain('evidence/certificate.pdf')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
