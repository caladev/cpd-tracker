import { describe, it, expect } from 'vitest'
import {
  fiscalYear,
  fyLabelFromDate,
  fyRange,
  fyLabelToYear,
  trienniumStartYearForDate,
  trienniumPeriodFor,
  defaultTrienniumForDate,
  findTrienniumForDate,
  isDateBetween,
  isCurrentlyActive,
  fyLabelsForTriennium,
  fyWithinTriennium,
} from './dates.js'

describe('financial year', () => {
  it('labels FY as the July-June financial year', () => {
    expect(fiscalYear('2023-09-28')).toBe(2024)
    expect(fiscalYear('2026-08-14')).toBe(2027)
    expect(fiscalYear('2026-06-30')).toBe(2026)
    expect(fiscalYear('2026-07-01')).toBe(2027)
    expect(fiscalYear(null)).toBeNull()
    expect(fiscalYear('garbage')).toBeNull()
  })

  it('renders and parses FY labels', () => {
    expect(fyLabelFromDate('2023-09-28')).toBe('FY24')
    expect(fyLabelFromDate('2026-08-14')).toBe('FY27')
    expect(fyLabelFromDate(null)).toBeNull()
    expect(fyLabelToYear('FY24')).toBe(2024)
    expect(fyLabelToYear('bogus')).toBeNull()
  })

  it('maps a FY label to its date range', () => {
    expect(fyRange('FY24')).toEqual({ start: '2023-07-01', end: '2024-06-30' })
    expect(fyRange('FY27')).toEqual({ start: '2026-07-01', end: '2027-06-30' })
    expect(fyRange('nope')).toBeNull()
  })
})

describe('triennium', () => {
  it('derives triennium start year for a date', () => {
    expect(trienniumStartYearForDate('2026-08-14')).toBe(2026)
    expect(trienniumStartYearForDate('2023-09-28')).toBe(2023)
    expect(trienniumStartYearForDate('2026-06-30')).toBe(2023)
    expect(trienniumStartYearForDate('2029-07-01')).toBe(2029)
    expect(trienniumStartYearForDate(null)).toBe(2023)
  })

  it('builds periods and labels', () => {
    expect(trienniumPeriodFor(2026)).toEqual({ start: '2026-07-01', end: '2029-06-30' })
    expect(defaultTrienniumForDate('2026-08-14').label).toBe('2026-2029')
    expect(defaultTrienniumForDate('2026-08-14').new).toBe(true)
  })

  it('finds the stored triennium covering a date', () => {
    const trienniums = [
      { id: 't-2023', period: { start: '2023-07-01', end: '2026-06-30' } },
      { id: 't-2026', period: { start: '2026-07-01', end: '2029-06-30' } },
    ]
    expect(findTrienniumForDate('2024-03-01', trienniums).id).toBe('t-2023')
    expect(findTrienniumForDate('2026-08-14', trienniums).id).toBe('t-2026')
    expect(findTrienniumForDate('2030-01-01', trienniums).new).toBe(true)
  })

  it('lists the financial years a triennium covers', () => {
    const tri = { period: { start: '2026-07-01', end: '2029-06-30' } }
    expect(fyLabelsForTriennium(tri)).toEqual(['FY27', 'FY28', 'FY29'])
    expect(fyLabelsForTriennium({ period: {} })).toEqual([])
    expect(fyLabelsForTriennium(null)).toEqual([])
    expect(fyLabelsForTriennium({})).toEqual([])
  })

  it('keeps a fitting FY but snaps an out-of-range one to the latest FY', () => {
    const tri = { period: { start: '2026-07-01', end: '2029-06-30' } }
    expect(fyWithinTriennium(tri, 'FY27')).toBe('FY27')
    expect(fyWithinTriennium(tri, 'FY25')).toBe('FY29')
    expect(fyWithinTriennium(null, 'FY25')).toBe('FY25')
    expect(fyWithinTriennium({ period: {} }, 'FY25')).toBe('FY25')
  })
})

describe('date range checks', () => {
  it('respects inclusive boundaries', () => {
    expect(isDateBetween('2026-07-01', { start: '2026-07-01', end: '2029-06-30' })).toBe(true)
    expect(isDateBetween('2029-06-30', { start: '2026-07-01', end: '2029-06-30' })).toBe(true)
    expect(isDateBetween('2029-07-01', { start: '2026-07-01', end: '2029-06-30' })).toBe(false)
    expect(isDateBetween('2026-06-30', { start: '2026-07-01', end: null })).toBe(false)
    expect(isDateBetween('bad', { start: '2026-07-01', end: null })).toBe(false)
  })

  it('flags open-ended periods as active now', () => {
    expect(isCurrentlyActive({ start: '2024-07-01', end: null }, new Date('2026-08-14'))).toBe(true)
    expect(isCurrentlyActive({ start: '2027-01-01', end: null }, new Date('2026-08-14'))).toBe(false)
  })
})