import path from 'node:path'
import fs from 'node:fs'
import { createDefaultData } from '../src/lib/defaults.js'

export function dataPaths(dataDir) {
  return {
    dataDir,
    dbFile: path.join(dataDir, 'cpd_data.db'),
    evidenceDir: path.join(dataDir, 'evidence'),
    rulesDir: path.join(dataDir, 'rules'),
  }
}

export function ensureDirs(dataDir) {
  const p = dataPaths(dataDir)
  fs.mkdirSync(p.evidenceDir, { recursive: true })
  fs.mkdirSync(p.rulesDir, { recursive: true })
  return p
}

export function sanitizeFilename(name) {
  if (typeof name !== 'string') return null
  const base = path.basename(name).replace(/[^\w.-]/g, '_').replace(/^\.+/, '')
  return base
}

const SAFE_EXT = /\.(png|jpe?g|gif|webp|heic|heif|pdf)$/i

export function uploadFilename(original, now = Date.now()) {
  const name = sanitizeFilename(original)
  if (!name || !SAFE_EXT.test(name)) return null
  return `${now}-${name}`
}

export function sanitizeId(id) {
  if (typeof id !== 'string') return null
  const clean = id.replace(/[^\w.-]/g, '')
  return /^[\w][\w.-]{0,119}$/.test(clean) ? clean : null
}

export function resolvePathIn(dataDir, rel) {
  if (typeof rel !== 'string' || !rel) return null
  const root = path.resolve(dataDir)
  const p = path.resolve(root, rel)
  if (p !== root && !p.startsWith(root + path.sep)) return null
  return p
}

export function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

export function loadData(dbFile, dataDir) {
  const parsed = readJSON(dbFile)
  if (parsed && validateData(parsed)) {
    parsed._path = dbFile
    return parsed
  }
  const fresh = createDefaultData()
  return fresh
}

export function writeDataAtomically(dbFile, data) {
  const tmp = `${dbFile}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  try {
    fs.renameSync(tmp, dbFile)
  } catch (err) {
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* ignore */
    }
    throw err
  }
  data.updatedAt = data.updatedAt
  return data
}

export function validateEntry(e) {
  return (
    e &&
    typeof e === 'object' &&
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    (e.status === 'Actual' || e.status === 'Draft') &&
    (typeof e.title === 'string' || typeof e.activity === 'string') &&
    typeof e.hours === 'number' &&
    Number.isFinite(e.hours) &&
    e.hours >= 0
  )
}

export function validateRuleset(r) {
  return (
    r &&
    typeof r === 'object' &&
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    typeof r.label === 'string' &&
    r.period &&
    typeof r.period.start === 'string' &&
    r.targets &&
    typeof r.targets === 'object'
  )
}

export function validateData(data) {
  if (!data || typeof data !== 'object') return false
  if (!Array.isArray(data.trienniums) || !Array.isArray(data.rulesets)) return false
  if (!Array.isArray(data.exemptions) || !Array.isArray(data.entries)) return false
  if (data.trienniums.some((t) => !t?.id || !t?.period)) return false
  if (data.rulesets.some((r) => !validateRuleset(r))) return false
  return true
}

export function normalizeData(data) {
  if (!validateData(data)) return null
  return {
    version: 1,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    trienniums: data.trienniums,
    rulesets: data.rulesets,
    exemptions: data.exemptions,
    entries: data.entries.filter((e) => validateEntry(e)),
  }
}