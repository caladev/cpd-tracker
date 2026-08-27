import { fyLabelFromDate, isDateBetween, isCurrentlyActive, findTrienniumForDate, monthOverlap, fyRange } from './dates.js'

export const STATUTES = ['Actual', 'Draft']

export function activeRulesetForDate(dateStr, rulesets = []) {
  const list = [...(rulesets || [])].sort((a, b) =>
    String(a.period?.start).localeCompare(String(b.period?.start)),
  )
  if (!list.length) return null
  const matching = list.find((r) => isDateBetween(dateStr, r.period))
  if (matching) return matching
  const latest = [...list].reverse().find((r) => r.period?.start && dateStr >= r.period.start)
  if (latest) return latest
  return list[0]
}

export function currentRuleset(rulesets = []) {
  const nowIso = new Date().toISOString().slice(0, 10)
  return activeRulesetForDate(nowIso, rulesets) ?? rulesets[0] ?? null
}

export function rulesetForTriennium(triennium, rulesets = []) {
  if (!triennium) return currentRuleset(rulesets)
  const found = (rulesets || []).find((r) => r.id === triennium.rulesetId)
  if (found) return found
  if (triennium.period?.start) {
    return activeRulesetForDate(triennium.period.start, rulesets) ?? currentRuleset(rulesets)
  }
  return currentRuleset(rulesets)
}

export function entryFY(e) {
  if (e.fy) return e.fy
  return fyLabelFromDate(e.date)
}

export function totalsForEntries(entries = []) {
  const totals = {
    entries: 0,
    hours: 0,
    verifiable: 0,
    nonVerifiable: 0,
    ethics: 0,
    onTheJob: 0,
  }
  for (const e of entries) {
    if (!e || typeof e.hours !== 'number') continue
    totals.entries += 1
    totals.hours += e.hours
    if (e.verifiable) {
      totals.verifiable += e.hours
      if (e.onTheJob) totals.onTheJob += e.hours
    } else {
      totals.nonVerifiable += e.hours
    }
    totals.ethics += Number(e.ethicsHours || 0)
  }
  return totals
}

export function activeEntries(entries = [], includeDrafts = false) {
  return (entries || []).filter((e) => includeDrafts || e.status !== 'Draft')
}

export function entriesForTriennium(entries = [], trienniumId) {
  return (entries || []).filter((e) => e.trienniumId === trienniumId)
}

export function totalsPerFY(entries = []) {
  const byFY = {}
  for (const e of entries) {
    const fy = entryFY(e) || '—'
    byFY[fy] = byFY[fy] || []
    byFY[fy].push(e)
  }
  return Object.fromEntries(Object.entries(byFY).map(([fy, list]) => [fy, totalsForEntries(list)]))
}

export function evaluateCompliance(entries = [], targets = {}, opts = {}) {
  const includeDrafts = Boolean(opts.includeDrafts)
  const eff = activeEntries(entries, includeDrafts)
  const totals = totalsForEntries(eff)
  const otjCap = Number(targets.otjMaxFractionOfVerifiable || 0) * totals.verifiable

  const scaled = (target, current) =>
    target === 0 ? (current === 0 ? 1 : current * 100) : Math.min(1, current / target)

  const fyList = (opts.fys && opts.fys.length ? opts.fys : opts.fy ? [opts.fy] : [])
    .filter(Boolean)
    .map(String)
  const now = opts.now || new Date().toISOString().slice(0, 10)
  const fyChecks = fyList.map((fy) => {
    const fyTotal = totalsForEntries(eff.filter((e) => entryFY(e) === fy)).hours
    const fyTarget = typeof opts.annualMinFor === 'function' ? opts.annualMinFor(fy) : targets.annualMinCpd
    const rng = fyRange(fy)
    const future = !rng ? false : rng.start > now
    const futureStart = rng ? rng.start : null
    return {
      key: `fy-${fy}`,
      fy,
      label: `Minimum CPD ${fy}`,
      target: fyTarget,
      current: fyTotal,
      percent: scaled(fyTarget, fyTotal),
      ok: future ? true : fyTotal >= (fyTarget || 0),
      kind: 'min',
      future,
      futureStart,
    }
  })

  const checks = [
    ...fyChecks,
    {
      key: 'tri-min',
      label: 'Minimum CPD this triennium',
      target: targets.trienniumMinCpd,
      current: totals.hours,
      percent: scaled(targets.trienniumMinCpd, totals.hours),
      ok: totals.hours >= (targets.trienniumMinCpd || 0),
      kind: 'min',
    },
    {
      key: 'tri-verifiable',
      label: 'Minimum verifiable CPD this triennium',
      target: targets.trienniumVerifiable,
      current: totals.verifiable,
      percent: scaled(targets.trienniumVerifiable, totals.verifiable),
      ok: totals.verifiable >= (targets.trienniumVerifiable || 0),
      kind: 'min',
    },
    {
      key: 'tri-ethics',
      label: 'Verifiable professional ethics',
      target: targets.ethicsVerifiablePerTriennium,
      current: totals.ethics,
      percent: scaled(targets.ethicsVerifiablePerTriennium, totals.ethics),
      ok: totals.ethics >= (targets.ethicsVerifiablePerTriennium || 0),
      kind: 'min',
    },
    {
      key: 'otj-cap',
      label: 'On-the-job training cap',
      target: otjCap,
      current: totals.onTheJob,
      percent: otjCap === 0 ? (totals.onTheJob === 0 ? 1 : totals.onTheJob * 100) : Math.min(1, totals.onTheJob / otjCap),
      ok: totals.onTheJob <= otjCap || otjCap === 0,
      kind: 'max',
    },
    {
      key: 'reading-cap',
      label: 'Non-verifiable (reading) cap',
      target: targets.nonVerifiableCapPerTriennium,
      current: totals.nonVerifiable,
      percent: scaled(targets.nonVerifiableCapPerTriennium, totals.nonVerifiable),
      ok: totals.nonVerifiable <= (targets.nonVerifiableCapPerTriennium || 0),
      kind: 'max',
    },
  ]
  return { totals, checks }
}

export function resolveTrienniumForEntry(entry, data = {}, anchorYear = 2023) {
  const source = entry.date || entry.fyStart || null
  if (!source) {
    const t = data.trienniums?.[0]
    return t ? t : defaultTrienniumForDate(new Date().toISOString().slice(0, 10), anchorYear)
  }
  return findTrienniumForDate(source, data.trienniums || [], anchorYear)
}

function round1(n) {
  return Math.round(n * 10) / 10
}

export function adjustedTargets(targets, exemptions = [], ctx = {}) {
  const list = exemptions || []
  const triMonths = ctx.period ? list.reduce((acc, x) => acc + monthOverlap(x.period, ctx.period), 0) : 0
  const fyPeriod = ctx.fy ? fyRange(ctx.fy) : null
  const fyMonths = fyPeriod
    ? list.reduce((acc, x) => acc + monthOverlap(x.period, fyPeriod), 0)
    : 0
  const rTri = Math.min(0.9, triMonths / 36)
  const rFy = Math.min(0.9, fyMonths / 12)
  if (rTri === 0 && rFy === 0) return { ...targets }
  return {
    ...targets,
    annualMinCpd: round1(targets.annualMinCpd * (1 - rFy)),
    trienniumMinCpd: round1(targets.trienniumMinCpd * (1 - rTri)),
    trienniumVerifiable: round1(targets.trienniumVerifiable * (1 - rTri)),
    ethicsVerifiablePerTriennium: targets.ethicsVerifiablePerTriennium,
    nonVerifiableCapPerTriennium: targets.nonVerifiableCapPerTriennium,
    otjMaxFractionOfVerifiable: targets.otjMaxFractionOfVerifiable,
  }
}