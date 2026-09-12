import express from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import url from 'node:url'
import { ZipArchive } from 'archiver'
import {
  dataPaths,
  ensureDirs,
  loadData,
  writeDataAtomically,
  normalizeData,
  uploadFilename,
  sanitizeId,
  resolvePathIn,
} from './lib.mjs'
import { detailCsv, evidenceFilesForExport, exportDate, summaryCsv } from './export.mjs'
import { scopeExport } from '../src/lib/exportScope.js'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, '..')
const DIST_DIR = path.join(APP_ROOT, 'dist')

const DATA_DIR = process.env.CPD_DATA_DIR
  ? path.resolve(process.env.CPD_DATA_DIR)
  : path.join(
      os.homedir(),
      'Library',
      'Mobile Documents',
      'com~apple~CloudDocs',
      'Docs',
      'CA',
      'cpd-tracker-app-data',
    )

ensureDirs(DATA_DIR)
const PATHS = dataPaths(DATA_DIR)

let data = loadData(PATHS.dbFile, DATA_DIR)
if (data && !fs.existsSync(PATHS.dbFile)) {
  writeDataAtomically(PATHS.dbFile, data)
}

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '2mb' }))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
})

function persist(nextData) {
  const normalized = normalizeData(nextData)
  if (!normalized) {
    const err = new Error('Invalid data payload')
    err.status = 400
    throw err
  }
  data = normalized
  writeDataAtomically(PATHS.dbFile, normalized)
  return normalized
}

app.get('/api/info', (_req, res) => {
  res.json({
    dataDir: DATA_DIR,
    dbFile: PATHS.dbFile,
    evidenceDir: PATHS.evidenceDir,
    rulesDir: PATHS.rulesDir,
    entryCount: data.entries.length,
    persisted: fs.existsSync(PATHS.dbFile),
  })
})

function withServerNow(d) {
  return { ...d, serverNow: new Date().toISOString() }
}

app.get('/api/data', (_req, res) => {
  res.json(withServerNow(data))
})

app.put('/api/data', (req, res) => {
  try {
    res.json(withServerNow(persist(req.body)))
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    const dest = req.body?.dest
    const key = req.body?.key
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' })
    }
    if (!['evidence', 'rules'].includes(dest)) {
      return res.status(400).json({ error: 'Invalid destination' })
    }
    const filename = uploadFilename(req.file.originalname)
    if (!filename) {
      return res.status(400).json({ error: 'Unsupported file type (image or PDF only)' })
    }

    let rel
    if (dest === 'evidence') {
      const entryId = sanitizeId(key)
      if (!entryId) return res.status(400).json({ error: 'Invalid entry id' })
      const dir = path.join(PATHS.evidenceDir, entryId)
      fs.mkdirSync(dir, { recursive: true })
      rel = path.join('evidence', entryId, filename)
      fs.writeFileSync(path.join(dir, filename), req.file.buffer)
    } else {
      rel = path.join('rules', filename)
      fs.writeFileSync(path.join(PATHS.rulesDir, filename), req.file.buffer)
    }

    res.json({
      kind: 'file',
      value: rel.split(path.sep).join('/'),
      filename,
      size: req.file.size,
      mime: req.file.mimetype,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/file', (req, res) => {
  const p = resolvePathIn(DATA_DIR, req.query.path || '')
  if (!p) return res.status(400).json({ error: 'Invalid path' })
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
    return res.status(404).json({ error: 'Not found' })
  }
  res.sendFile(p)
})

app.delete('/api/file', (req, res) => {
  const p = resolvePathIn(DATA_DIR, req.query.path || '')
  if (!p) return res.status(400).json({ error: 'Invalid path' })
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not found' })
  fs.unlinkSync(p)
  res.json({ ok: true })
})

app.use('/api/export', (req, res, next) => {
  try {
    res.locals.exportData = scopeExport(data, req.query.trienniumId)
    next()
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.get('/api/export/archive', async (req, res) => {
  const data = res.locals.exportData
  const date = exportDate()
  const includeEvidence = req.query.includeEvidence === 'true'
  const archive = new ZipArchive({ zlib: { level: 9 } })
  const evidenceFiles = includeEvidence ? evidenceFilesForExport(data, DATA_DIR, PATHS.evidenceDir) : []
  const names = new Map(evidenceFiles.map((file) => [file.reference, file.name]))

  archive.on('error', (err) => {
    if (!res.headersSent) res.status(500).json({ error: err.message })
    else res.destroy(err)
  })

  res.attachment(`cpd-export-${date}.zip`)
  archive.pipe(res)
  archive.append(`\ufeff${summaryCsv(data)}`, { name: `cpd-summary-${date}.csv` })
  archive.append(`\ufeff${detailCsv(data, names)}`, { name: `cpd-detail-${date}.csv` })
  if (includeEvidence) {
    for (const evidence of evidenceFiles) {
      archive.file(evidence.file, { name: evidence.name })
    }
  }
  await archive.finalize()
})

app.get('/api/export/:report', (req, res) => {
  const data = res.locals.exportData
  const date = exportDate()
  const reports = {
    summary: { filename: `cpd-summary-${date}.csv`, content: summaryCsv(data) },
    detail: { filename: `cpd-detail-${date}.csv`, content: detailCsv(data) },
  }
  const report = reports[req.params.report]
  if (!report) return res.status(404).json({ error: 'Unknown export report' })
  res.attachment(report.filename)
  res.type('text/csv; charset=utf-8').send(`\ufeff${report.content}`)
})

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
}

const PORT = Number(process.env.PORT || 39889)
app.listen(PORT, () => {
  console.log(`[cpd] API listening on http://localhost:${PORT}`)
  console.log(`[cpd] data dir: ${DATA_DIR}`)
})
