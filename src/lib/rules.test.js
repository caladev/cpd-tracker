import { describe, it, expect } from 'vitest'
import {
  totalsForEntries,
  evaluateCompliance,
  activeEntries,
  entriesForTriennium,
  totalsPerFY,
  activeRulesetForDate,
  currentRuleset,
  rulesetForTriennium,
  resolveTrienniumForEntry,
  adjustedTargets,
} from './rules.js'

const T = {
  annualMinCpd: 20,
  trienniumMinCpd: 120,
  trienniumVerifiable: 90,
  ethicsVerifiablePerTriennium: 6,
  otjMaxFractionOfVerifiable: 0.5,
  nonVerifiableCapPerTriennium: 30,
}

function entry(overrides = {}) {
  return {
    id: 'e1',
    trienniumId: 't-2026',
    fy: 'FY27',
    status: 'Actual',
    date: '2026-09-01',
    title: 'Course',
    hours: 10,
    verifiable: true,
    onTheJob: false,
    ethicsHours: 0,
    ...overrides,
  }
}

describe('totalsForEntries', () => {
  it('breaks down totals by verifiable / non-verifiable / ethics / OJT', () => {
    const entries = [
      entry({ id: 'a', hours: 8, verifiable: true }),
      entry({ id: 'b', hours: 7, verifiable: true, onTheJob: true }),
      entry({ id: 'c', hours: 5, verifiable: true, ethicsHours: 2 }),
      entry({ id: 'd', hours: 10, verifiable: false }),
    ]
    const t = totalsForEntries(entries)
    expect(t.entries).toBe(4)
    expect(t.hours).toBe(30)
    expect(t.verifiable).toBe(20)
    expect(t.nonVerifiable).toBe(10)
    expect(t.onTheJob).toBe(7)
    expect(t.ethics).toBe(2)
  })

  it('ignores garbage rows safely', () => {
    const t = totalsForEntries([null, {}, entry({ hours: undefined })])
    expect(t.entries).toBe(0)
    expect(t.hours).toBe(0)
  })
})

describe('activeEntries / filtering', () => {
  it('excludes drafts unless asked', () => {
    const drafts = [entry({ id: 'd1', status: 'Draft', trienniumId: 't-other' })]
    expect(activeEntries(drafts).length).toBe(0)
    expect(activeEntries(drafts, true).length).toBe(1)
    const mixed = [...drafts, entry()]
    expect(entriesForTriennium(mixed, 't-2026').length).toBe(1)
  })

  it('groups totals per FY', () => {
    const entries = [
      entry({ id: 'a', fy: 'FY24', hours: 3 }),
      entry({ id: 'b', fy: 'FY27', hours: 9 }),
    ]
    const byFY = totalsPerFY(entries)
    expect(byFY.FY24.hours).toBe(3)
    expect(byFY.FY27.hours).toBe(9)
  })

  it('counts a draft only once it is promoted to Actual', () => {
    const draft = entry({ id: 'd', status: 'Draft', hours: 8 })
    expect(totalsForEntries(activeEntries([draft])).hours).toBe(0)
    const promoted = { ...draft, status: 'Actual' }
    expect(totalsForEntries(activeEntries([promoted])).hours).toBe(8)
    expect(activeEntries([promoted], true)[0].status).toBe('Actual')
  })
})

describe('evaluateCompliance', () => {
  it('flags missing minimums', () => {
    const { totals, checks } = evaluateCompliance([entry({ hours: 10 })], T, { fy: 'FY27' })
    expect(totals.hours).toBe(10)
    const fy = checks.find((c) => c.fy === 'FY27')
    const tri = checks.find((c) => c.key === 'tri-min')
    const ver = checks.find((c) => c.key === 'tri-verifiable')
    const eth = checks.find((c) => c.key === 'tri-ethics')
    expect(fy.current).toBe(10)
    expect(fy.ok).toBe(false)
    expect(tri.ok).toBe(false)
    expect(ver.ok).toBe(false)
    expect(eth.current).toBe(0)
    expect(eth.ok).toBe(false)
  })

  it('satisfies requirements when targets met', () => {
    const entries = [
      entry({ id: 'a', hours: 25, verifiable: true }),
      entry({ id: 'b', hours: 25, verifiable: true }),
      entry({ id: 'c', hours: 25, verifiable: true, onTheJob: true }),
      entry({ id: 'd', hours: 45, verifiable: true }),
      entry({ id: 'e', hours: 0, verifiable: false, ethicsHours: 0 }),
    ]
    const { checks } = evaluateCompliance(entries, T, { fy: 'FY27' })
    const map = Object.fromEntries(checks.map((c) => [c.key, c.ok]))
    expect(map['fy-FY27']).toBe(true)
    expect(map['tri-min']).toBe(true)
    expect(map['tri-verifiable']).toBe(true)
  })

  it('enforces the OJT cap and reading cap', () => {
    const entries = [
      entry({ id: 'a', hours: 82, verifiable: true, onTheJob: true }),
      entry({ id: 'b', hours: 20, verifiable: true }),
      entry({ id: 'c', hours: 40, verifiable: false }),
    ]
    const { checks } = evaluateCompliance(entries, T, { fy: 'FY27' })
    const otj = checks.find((c) => c.key === 'otj-cap')
    const reading = checks.find((c) => c.key === 'reading-cap')
    expect(otj.target).toBe(51)
    expect(otj.current).toBe(82)
    expect(otj.ok).toBe(false)
    expect(reading.current).toBe(40)
    expect(reading.ok).toBe(false)
    expect(otj.percent).toBe(1)
  })

  it('excludes drafts from compliance by default', () => {
    const { totals } = evaluateCompliance([entry({ status: 'Draft', hours: 999 })], T, { fy: 'FY27' })
    expect(totals.hours).toBe(0)
  })

  it('emits one check per FY of a triennium', () => {
    const entries = [
      entry({ id: 'a', fy: 'FY26', hours: 20 }),
      entry({ id: 'b', fy: 'FY27', hours: 8 }),
      entry({ id: 'c', fy: 'FY28', hours: 0 }),
    ]
    const { checks } = evaluateCompliance(entries, T, { fys: ['FY26', 'FY27', 'FY28'] })
    const fyChecks = checks.filter((c) => c.fy)
    expect(fyChecks.length).toBe(3)
    expect(fyChecks[0].key).toBe('fy-FY26')
    expect(fyChecks[0].current).toBe(20)
    expect(fyChecks[0].ok).toBe(true)
    expect(fyChecks[1].current).toBe(8)
    expect(fyChecks[1].ok).toBe(false)
    expect(fyChecks[2].current).toBe(0)
  })

  it('honours per-FY annual targets via annualMinFor', () => {
    const { checks } = evaluateCompliance([entry({ fy: 'FY25', hours: 12 })], T, {
      fys: ['FY25'],
      annualMinFor: (fy) => (fy === 'FY25' ? 10 : 20),
    })
    const fy = checks.find((c) => c.fy === 'FY25')
    expect(fy.target).toBe(10)
    expect(fy.ok).toBe(true)
  })

  it('marks future financial years as future, never as unmet', () => {
    const { checks } = evaluateCompliance([entry({ fy: 'FY27', hours: 0 })], T, {
      fys: ['FY26', 'FY27', 'FY28'],
      now: '2026-08-14',
    })
    const past = checks.find((c) => c.fy === 'FY26')
    const current = checks.find((c) => c.fy === 'FY27')
    const future = checks.find((c) => c.fy === 'FY28')
    expect(past.future).toBe(false)
    expect(current.future).toBe(false)
    expect(future.future).toBe(true)
    expect(future.ok).toBe(true)
    expect(future.futureStart).toBe('2027-07-01')
  })
})

describe('ruleset selection', () => {
  const rulesets = [
    { id: 'old', label: 'Old', period: { start: '2020-07-01', end: '2024-06-30' } },
    { id: 'cur', label: 'Current', period: { start: '2024-07-01', end: null } },
  ]

  it('picks the ruleset active at a date', () => {
    expect(activeRulesetForDate('2022-01-01', rulesets).id).toBe('old')
    expect(activeRulesetForDate('2026-08-14', rulesets).id).toBe('cur')
    expect(activeRulesetForDate('2026-08-14', [])).toBeNull()
  })

  it('falls back sensibly when no period matches', () => {
    const before = activeRulesetForDate('2019-01-01', rulesets)
    expect(before.id).toBe('old')
    expect(currentRuleset(rulesets).id).toBe('cur')
    expect(rulesetForTriennium({ rulesetId: 'missing' }, rulesets).id).toBe('cur')
    expect(rulesetForTriennium(null, [])).toBeNull()
  })
})

describe('resolveTrienniumForEntry', () => {
  const data = {
    trienniums: [{ id: 't-2023', period: { start: '2023-07-01', end: '2026-06-30' } }],
  }

  it('uses an existing triennium for a date', () => {
    expect(resolveTrienniumForEntry(entry({ date: '2024-03-01' }), data).id).toBe('t-2023')
  })

  it('derives a fresh triennium for dates outside stored ones', () => {
    const t = resolveTrienniumForEntry(entry({ date: '2026-08-14' }), data)
    expect(t.new).toBe(true)
    expect(t.label).toBe('2026-2029')
  })

  it('falls back to first triennium for undated entries', () => {
    expect(resolveTrienniumForEntry(entry({ date: null }), data).id).toBe('t-2023')
  })
})

describe('adjustedTargets (pro-rata exemptions)', () => {
  const parental = [
    {
      id: 'x1',
      period: { start: '2024-10-21', end: '2025-04-21' },
      proRataMonths: 6,
      totalMonths: 36,
    },
  ]

  it('reduces triennium mins by the pro-rata ratio', () => {
    const out = adjustedTargets(T, [], {})
    expect(out).toEqual(T)
    const adjusted = adjustedTargets(T, parental, { period: { start: '2023-07-01', end: '2026-06-30' } })
    expect(adjusted.trienniumMinCpd).toBe(100)
    expect(adjusted.trienniumVerifiable).toBe(75)
    expect(adjusted.ethicsVerifiablePerTriennium).toBe(6)
  })

  it('reduces the annual min for the affected financial year', () => {
    const adjusted = adjustedTargets(T, parental, { period: { start: '2023-07-01', end: '2026-06-30' }, fy: 'FY25' })
    expect(adjusted.annualMinCpd).toBe(10)
    const unaffected = adjustedTargets(T, parental, {
      period: { start: '2023-07-01', end: '2026-06-30' },
      fy: 'FY26',
    })
    expect(unaffected.annualMinCpd).toBe(20)
  })

  it('caps the ratio so targets never vanish', () => {
    const long = [{ period: { start: '2020-07-01', end: null }, proRataMonths: 100, totalMonths: 36 }]
    const adjusted = adjustedTargets(T, long, { period: { start: '2023-07-01', end: '2026-06-30' } })
    expect(adjusted.trienniumMinCpd).toBeGreaterThan(0)
  })
})