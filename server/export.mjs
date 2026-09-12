import fs from 'node:fs'
import path from 'node:path'
import { resolvePathIn } from './lib.mjs'

function csvValue(value) {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csv(rows) {
  return rows.map((row) => row.map(csvValue).join(',')).join('\n')
}

function evidenceReferences(entry, names) {
  return (entry.evidence || [])
    .map((evidence) => (evidence.kind === 'url' ? evidence.value : names?.get(evidence.value) || evidence.filename || evidence.value))
    .join('; ')
}

export function exportDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function summaryCsv(data) {
  const trienniumLabels = new Map((data.trienniums || []).map((triennium) => [triennium.id, triennium.label]))
  const summaries = new Map()

  for (const entry of data.entries || []) {
    const key = [entry.trienniumId || '', entry.fy || '', entry.status || 'Actual'].join('\u0000')
    const existing = summaries.get(key) || {
      triennium: trienniumLabels.get(entry.trienniumId) || entry.trienniumLabel || '',
      fy: entry.fy || '',
      status: entry.status || 'Actual',
      entries: 0,
      hours: 0,
      verifiable: 0,
      nonVerifiable: 0,
      ethics: 0,
      onTheJob: 0,
    }
    const hours = Number(entry.hours) || 0
    existing.entries += 1
    existing.hours += hours
    existing.verifiable += entry.verifiable ? hours : 0
    existing.nonVerifiable += entry.verifiable ? 0 : hours
    existing.ethics += Number(entry.ethicsHours) || 0
    existing.onTheJob += entry.onTheJob ? hours : 0
    summaries.set(key, existing)
  }

  const rows = [...summaries.values()]
    .sort((a, b) =>
      [a.triennium, a.fy, a.status].join('\u0000').localeCompare([b.triennium, b.fy, b.status].join('\u0000')),
    )
    .map((summary) => [
      summary.triennium,
      summary.fy,
      summary.status,
      summary.entries,
      summary.hours,
      summary.verifiable,
      summary.nonVerifiable,
      summary.ethics,
      summary.onTheJob,
    ])

  return csv([
    [
      'Triennium',
      'Financial Year',
      'Status',
      'Entries',
      'CPD Hours',
      'Verifiable Hours',
      'Non-verifiable Hours',
      'Ethics Hours',
      'On-the-job Hours',
    ],
    ...rows,
  ])
}

export function detailCsv(data, names) {
  const trienniumLabels = new Map((data.trienniums || []).map((triennium) => [triennium.id, triennium.label]))
  const rows = [...(data.entries || [])]
    .sort((a, b) => `${b.date || ''}\u0000${b.title || ''}`.localeCompare(`${a.date || ''}\u0000${a.title || ''}`))
    .map((entry) => [
      trienniumLabels.get(entry.trienniumId) || entry.trienniumLabel || '',
      entry.fy || '',
      entry.status || 'Actual',
      entry.date || 'Undated',
      entry.title || entry.activity || '',
      entry.provider || '',
      entry.hours ?? '',
      entry.relevance || '',
      entry.verifiable ? 'Yes' : 'No',
      entry.onTheJob ? 'Yes' : 'No',
      entry.ethicsHours || 0,
      entry.specialisation ? 'Yes' : 'No',
      evidenceReferences(entry, names),
      entry.notes || '',
    ])

  return csv([
    [
      'Triennium',
      'Financial Year',
      'Status',
      'Date',
      'Activity',
      'Provider',
      'Hours',
      'Relevant to role?',
      'Verifiable?',
      'On-the-job?',
      'Ethics Hours',
      'Specialisation-related?',
      'Evidence References',
      'Notes',
    ],
    ...rows,
  ])
}

export function evidenceFilesForExport(data, dataDir, evidenceDir) {
  const evidenceRoot = path.resolve(evidenceDir)
  const files = new Map()
  const seen = new Set()

  for (const entry of data.entries || []) {
    for (const evidence of entry.evidence || []) {
      if (evidence.kind !== 'file' || typeof evidence.value !== 'string') continue
      const file = resolvePathIn(dataDir, evidence.value)
      if (!file || !file.startsWith(`${evidenceRoot}${path.sep}`)) continue
      if (seen.has(file)) continue
      try {
        if (!fs.statSync(file).isFile()) continue
      } catch {
        continue
      }
      const basename = path.basename(file)
      const ext = path.extname(basename)
      const stem = basename.slice(0, basename.length - ext.length)
      let archiveName = `evidence/${basename}`
      let suffix = 2
      while (files.has(archiveName.toLowerCase())) archiveName = `evidence/${stem}-${suffix++}${ext}`
      seen.add(file)
      files.set(archiveName.toLowerCase(), { name: archiveName, file, reference: evidence.value })
    }
  }

  return [...files.values()]
}
