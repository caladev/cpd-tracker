import { defaultTrienniumForDate } from './dates.js'

export const CR7_RULESET_ID = 'rs-cr7-2025'

export function createDefaultRulesets(now = new Date()) {
  return [
    {
      id: CR7_RULESET_ID,
      label: 'CR 7 (issued 23 May 2025)',
      period: { start: '2024-07-01', end: null },
      memberType: 'CA',
      regulationPdf: null,
      targets: {
        annualMinCpd: 20,
        trienniumMinCpd: 120,
        trienniumVerifiable: 90,
        ethicsVerifiablePerTriennium: 6,
        otjMaxFractionOfVerifiable: 0.5,
        nonVerifiableCapPerTriennium: 30,
      },
      notes:
        'CA/Affiliate: 120 hrs per triennium, 90 verifiable, min 20 per year; 6 hrs verifiable ethics; OJT <= 50% of verifiable.',
    },
  ]
}

export function createDefaultData(now = new Date()) {
  const iso = now.toISOString()
  const today = iso.slice(0, 10)
  const triennium = defaultTrienniumForDate(today)
  const stored = {
    id: `t-${triennium.period.start.slice(0, 4)}`,
    label: triennium.label,
    period: triennium.period,
    rulesetId: CR7_RULESET_ID,
  }
  return {
    version: 1,
    createdAt: iso,
    updatedAt: iso,
    trienniums: [stored],
    rulesets: createDefaultRulesets(now),
    exemptions: [],
    entries: [],
  }
}