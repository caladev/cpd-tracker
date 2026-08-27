export const FY_START_MONTH = 7

function pad(n) {
  return String(n).padStart(2, '0')
}

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function isDateBetween(dateStr, period = {}) {
  const d = parseDate(dateStr)
  if (!d || !period.start) return false
  const start = parseDate(period.start)
  const end = period.end ? parseDate(period.end) : null
  if (!start) return false
  if (d < start) return false
  if (end && d > end) return false
  return true
}

export function fiscalYear(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return null
  const y = d.getFullYear()
  return d.getMonth() + 1 >= FY_START_MONTH ? y + 1 : y
}

export function fyLabelFromDate(dateStr) {
  const y = fiscalYear(dateStr)
  return y == null ? null : `FY${String(y).slice(2)}`
}

export function fyLabelToYear(fyLabel) {
  const m = /^FY(\d{2})$/.exec(String(fyLabel || ''))
  return m ? 2000 + Number(m[1]) : null
}

export function fyRange(fyLabel) {
  const endYear = fyLabelToYear(fyLabel)
  if (endYear == null) return null
  return { start: `${endYear - 1}-07-01`, end: `${endYear}-06-30` }
}

export function currentFYLabel(now = new Date()) {
  return fyLabelFromDate(toISODate(now)) ?? ''
}

export function fyStartYear(dateStr) {
  const y = fiscalYear(dateStr)
  return y == null ? null : y - 1
}

export function trienniumStartYearForDate(dateStr, anchorYear = 2023) {
  const base = fyStartYear(dateStr)
  if (base == null) return anchorYear
  const diff = base - anchorYear
  const floor = diff - (((diff % 3) + 3) % 3)
  return anchorYear + floor
}

export function trienniumPeriodFor(startYear) {
  return {
    start: `${startYear}-07-01`,
    end: `${startYear + 3}-06-30`,
  }
}

export function trienniumLabelFor(startYear) {
  return `${startYear}-${startYear + 3}`
}

export function fyLabelsForTriennium(tri) {
  const startYear = tri?.period?.start ? Number(tri.period.start.slice(0, 4)) : null
  if (startYear == null) return []
  return [startYear + 1, startYear + 2, startYear + 3].map((y) => `FY${String(y).slice(2)}`)
}

export function fyWithinTriennium(tri, prefer) {
  const fys = fyLabelsForTriennium(tri)
  if (!fys.length) return prefer || ''
  return fys.includes(prefer) ? prefer : fys[fys.length - 1]
}

export function defaultTrienniumForDate(dateStr, anchorYear = 2023) {
  const startYear = trienniumStartYearForDate(dateStr, anchorYear)
  return {
    new: true,
    id: `t-${startYear}`,
    label: trienniumLabelFor(startYear),
    period: trienniumPeriodFor(startYear),
    rulesetId: null,
  }
}

export function findTrienniumForDate(dateStr, trienniums = [], anchorYear = 2023) {
  const existing = (trienniums || []).find((t) => isDateBetween(dateStr, t.period))
  if (existing) return existing
  return defaultTrienniumForDate(dateStr, anchorYear)
}

export function isCurrentlyActive(period = {}, now = new Date()) {
  return isDateBetween(toISODate(now), period)
}

export function monthOverlap(a = {}, b = {}) {
  const as = parseDate(a.start)
  const bs = parseDate(b.start)
  if (!as || !bs) return 0
  const start = as > bs ? as : bs
  const ends = [a.end, b.end].filter(Boolean).map(parseDate).filter(Boolean)
  const end = ends.length ? ends.sort((x, y) => x - y)[0] : null
  if (!end || start >= end) return 0
  return (end.getFullYear() * 12 + end.getMonth()) - (start.getFullYear() * 12 + start.getMonth())
}