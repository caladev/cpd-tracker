import React, { useEffect, useMemo, useState } from 'react'
import { PlusIcon, TrashIcon, ShieldIcon, CheckIcon } from './Icons.jsx'
import { adjustedTargets } from '../lib/rules.js'
import { monthOverlap } from '../lib/dates.js'

const REASONS = [
  'Parental leave',
  'Unemployment',
  'Illness',
  'Part-time / casual employment',
]

const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('en-AU')

function ExemptionRow({ ex, ruleset, onDelete }) {
  const original = ruleset?.targets || {}
  const adjusted = adjustedTargets(original, [ex], {
    period: ruleset?.period,
    fy: null,
  })
  const months = monthOverlap(ex.period, ruleset?.period || {})

  return (
    <div className="card exemption-card">
      <div className="exemption-head">
        <div>
          <div className="ex-head-title">
            <ShieldIcon width={16} height={16} />
            {ex.label}
          </div>
          <div className="muted">
            {ex.reason} · {ex.period?.start} → {ex.period?.end} ({months} pro-rata months)
          </div>
        </div>
        <button className="icon-btn icon-btn--danger" title="Remove exemption" onClick={() => onDelete(ex.id)}>
          <TrashIcon width={16} height={16} />
        </button>
      </div>
      <div className="targets-grid exemption-grid">
        {[
          ['Triennium total', 'trienniumMinCpd', original.trienniumMinCpd, adjusted.trienniumMinCpd],
          ['Verifiable', 'trienniumVerifiable', original.trienniumVerifiable, adjusted.trienniumVerifiable],
          ['Ethics', 'ethicsVerifiablePerTriennium', original.ethicsVerifiablePerTriennium, adjusted.ethicsVerifiablePerTriennium],
        ].map(([label, , before, after]) => (
          <div key={label} className="target-field">
            <span>{label}</span>
            <span className="adj">
              {fmt(before)} <span className="adj-arrow">→</span>{' '}
              <strong className={after < before ? 'adj-down' : ''}>{fmt(after)}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Exemptions({ data, persist, ruleset }) {
  const [items, setItems] = useState(() => data.exemptions.map((x) => ({ ...x })))
  const [draft, setDraft] = useState({
    label: '',
    reason: REASONS[0],
    start: '',
    end: '',
  })
  const [saved, setSaved] = useState(true)

  useEffect(() => {
    setSaved(JSON.stringify(items) === JSON.stringify(data.exemptions))
  }, [items, data.exemptions])

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const add = () => {
    if (!draft.label.trim()) return
    const period = { start: draft.start, end: draft.end || null }
    if (!period.start) {
      alert('Pick a start date for the absence period.')
      return
    }
    const startYear = Number(period.start.slice(0, 4))
    const ex = {
      id: `ex-${Date.now()}`,
      label: draft.label.trim(),
      reason: draft.reason,
      period,
      proRataMonths: monthOverlap(period, ruleset?.period || {}),
      totalMonths: 36,
      rulesetId: ruleset?.id,
    }
    setItems([...items, ex])
    setDraft({ label: '', reason: REASONS[0], start: '', end: '' })
  }

  const remove = (id) => setItems(items.filter((x) => x.id !== id))

  const save = async () => {
    try {
      await persist({ ...data, exemptions: items })
    } catch (err) {
      alert(err.message)
    }
  }

  const preview = useMemo(
    () =>
      items.length
        ? adjustedTargets(ruleset?.targets || {}, items, { period: ruleset?.period, fy: null })
        : null,
    [items, ruleset],
  )

  return (
    <div>
      <div className="hero">
        <div>
          <h2 className="hero-title">Pro-rata exemptions</h2>
          <p className="hero-sub">
            Absences reduce triennium and annual minimums proportionally — but never the 6 hrs of
            verifiable ethics (CR 7.5(c)).
          </p>
        </div>
      </div>

      <div className="card form-card">
        <h3 className="card-title">New exemption</h3>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Label</span>
            <input
              className="input"
              placeholder="e.g. Parental leave 2026-2027"
              value={draft.label}
              onChange={(e) => set({ label: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">Reason</span>
            <select className="select" value={draft.reason} onChange={(e) => set({ reason: e.target.value })}>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">From</span>
            <input className="input" type="date" value={draft.start} onChange={(e) => set({ start: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">To</span>
            <input className="input" type="date" value={draft.end} onChange={(e) => set({ end: e.target.value })} />
          </label>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={add}>
          <PlusIcon width={15} height={15} />
          Add exemption
        </button>
      </div>

      {items.length === 0 ? (
        <div className="empty small">
          <p>No exemptions yet. If you took parental leave, extended sick leave, or work part-time, add it here.</p>
        </div>
      ) : (
        <div className="stack">
          {items.map((ex) => (
            <ExemptionRow key={ex.id} ex={ex} ruleset={ruleset} onDelete={remove} />
          ))}
        </div>
      )}

      {preview && (
        <div className="card summary-card">
          <div className="card-head">
            <h3>Compliance targets for {ruleset?.label}</h3>
            <span className="muted">after exemption</span>
          </div>
          <div className="targets-grid">
            {[
              ['Triennium total', preview.trienniumMinCpd],
              ['Verifiable', preview.trienniumVerifiable],
              ['Ethics (never pro-rated)', preview.ethicsVerifiablePerTriennium],
              ['Annual min (current FY)', preview.annualMinCpd],
            ].map(([label, value]) => (
              <div key={label} className="target-field">
                <span>{label}</span>
                <strong>{fmt(value)}h</strong>
              </div>
            ))}
          </div>
          <div className="ok-note">
            <CheckIcon width={15} height={15} />
            Applies to the Dashboard automatically.
          </div>
        </div>
      )}

      <div className="sticky-bar">
        <span className="muted">Exemptions are retained with your records (CR 7.6)</span>
        <button className="btn btn--primary" onClick={save} disabled={saved}>
          {saved ? 'Saved' : 'Save exemptions'}
        </button>
      </div>
    </div>
  )
}