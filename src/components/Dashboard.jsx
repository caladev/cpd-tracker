import React, { useMemo, useCallback } from 'react'
import ProgressRing from './ProgressRing.jsx'
import { CheckIcon, WarnIcon, XIcon, PlusIcon, ClockIcon } from './Icons.jsx'
import {
  evaluateCompliance,
  entriesForTriennium,
  totalsPerFY,
  entryFY,
  adjustedTargets,
} from '../lib/rules.js'
import { fyLabelsForTriennium } from '../lib/dates.js'

const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('en-AU')

function statusOf(check) {
  if (check.ok) return 'ok'
  if (check.kind === 'max') return check.current >= check.target * 0.9 ? 'warn' : 'ok'
  return check.current >= check.target * 0.8 ? 'warn' : 'bad'
}

function RuleRow({ check }) {
  if (check.future) {
    return (
      <div className="rule-row rule-row--future">
        <span className="rule-icon">
          <ClockIcon width={16} height={16} />
        </span>
        <div className="rule-main">
          <div className="rule-label">{check.label}</div>
          <div className="rule-meta">Starts {check.futureStart || '—'} · target {fmt(check.target)}h</div>
        </div>
        <div className="rule-bar">
          <div className="rule-bar-fill rule-bar-fill--future" style={{ width: '0%' }} />
        </div>
        <span className="rule-status">Future year</span>
      </div>
    )
  }
  const st = statusOf(check)
  const Icon = check.ok ? CheckIcon : st === 'warn' ? WarnIcon : XIcon
  return (
    <div className={`rule-row rule-row--${st}`}>
      <span className="rule-icon">
        <Icon width={16} height={16} />
      </span>
      <div className="rule-main">
        <div className="rule-label">{check.label}</div>
        <div className="rule-meta">
          {fmt(check.current)}h / {fmt(check.target)}h
        </div>
      </div>
      <div className="rule-bar">
        <div
          className="rule-bar-fill"
          style={{
            width: `${Math.min(100, check.percent * 100)}%`,
            background: st === 'ok' ? 'var(--accent)' : st === 'warn' ? 'var(--warn)' : 'var(--danger)',
          }}
        />
      </div>
      <span className="rule-status">{check.ok ? 'On track' : 'Action needed'}</span>
    </div>
  )
}

function fyLabelsFor(triennium) {
  return fyLabelsForTriennium(triennium)
}

function FYBars({ entries, triennium, annualMinFor }) {
  const byFY = useMemo(() => totalsPerFY(entries), [entries])
  const fyLabels = useMemo(() => {
    const labels = fyLabelsFor(triennium)
    if (labels.length) return labels
    return Object.keys(byFY).sort()
  }, [triennium, byFY])

  return (
    <div className="fybars">
      {fyLabels.map((fy) => {
        const hours = byFY[fy]?.hours || 0
        const min = annualMinFor ? annualMinFor(fy) : 20
        return (
          <div key={fy} className="fybar">
            <div className="fybar-top">
              <span className="fybar-label">{fy}</span>
              <span className="fybar-value">
                {fmt(hours)}h / {min}h min
              </span>
            </div>
            <div className="fybar-track">
              <div className="fybar-fill" style={{ width: `${Math.min(100, (hours / Math.max(1, min)) * 100)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Dashboard({ data, triennium, ruleset, onEdit }) {
  const triEntries = useMemo(
    () => (triennium ? entriesForTriennium(data.entries, triennium.id) : []),
    [data.entries, triennium],
  )

  const baseT = ruleset?.targets || {}

  const triTargets = useMemo(
    () => adjustedTargets(baseT, data.exemptions, { period: triennium?.period }),
    [baseT, data.exemptions, triennium],
  )
  const annualMinFor = useCallback(
    (fy) => adjustedTargets(baseT, data.exemptions, { period: triennium?.period, fy }).annualMinCpd,
    [baseT, data.exemptions, triennium],
  )
  const fyLabels = useMemo(() => fyLabelsFor(triennium), [triennium])

  const res = useMemo(
    () => evaluateCompliance(triEntries, triTargets, { fys: fyLabels, annualMinFor, now: data.serverNow }),
    [triEntries, triTargets, fyLabels, annualMinFor, data.serverNow],
  )

  const exemptionsActive = (data.exemptions || []).filter((x) => x.period).length > 0
  const drafts = useMemo(() => triEntries.filter((e) => e.status === 'Draft').length, [triEntries])
  const checksOk = res.checks.filter((c) => c.ok)
  const recent = useMemo(() => [...triEntries].reverse().slice(0, 6), [triEntries])

  if (!triennium) {
    return (
      <div className="empty">
        <h2>No triennium configured yet</h2>
        <p>Add a triennium from Settings, then start logging CPD.</p>
      </div>
    )
  }

  const ringStatus = (c) => (c.ok ? 'ok' : c.percent >= 0.8 ? 'warn' : 'bad')

  const byKey = Object.fromEntries(res.checks.map((c) => [c.key, c]))
  const fyChecks = res.checks.filter((c) => c.fy)
  const triChecks = res.checks.filter((c) => !c.fy)

  return (
    <div className="dash">
      <section className="hero">
        <div>
          <div className="hero-eyebrow">
            {triennium.label} triennium{' '}
            {exemptionsActive ? '· pro-rata exemption applied' : '· all financial years'}
          </div>
          <h2 className="hero-title">{ruleset?.label || 'Rules'}</h2>
          <p className="hero-sub">
            {checksOk.length} of {res.checks.length} CPD requirements met across this triennium ·{' '}
            {drafts} draft {drafts === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <button className="btn btn--ghost" onClick={() => onEdit({})}>
          <PlusIcon width={16} height={16} />
          New entry
        </button>
      </section>

      <section className="grid rings-grid">
        <div className="card ring-card">
          <ProgressRing
            value={byKey['tri-min']?.current ?? 0}
            max={triTargets?.trienniumMinCpd || 1}
            id="tri"
            from="#6366f1"
            to="#8b5cf6"
            status={ringStatus(byKey['tri-min'])}
          >
            <div className="ring-num">{fmt(byKey['tri-min']?.current ?? 0)}</div>
            <div className="ring-cap">{fmt(triTargets?.trienniumMinCpd)}h/triennium</div>
          </ProgressRing>
          <div className="ring-label">CPD this triennium</div>
        </div>

        <div className="card ring-card">
          <ProgressRing
            value={byKey['tri-verifiable']?.current ?? 0}
            max={triTargets?.trienniumVerifiable || 1}
            id="ver"
            from="#0ea5e9"
            to="#22d3ee"
            status={ringStatus(byKey['tri-verifiable'])}
          >
            <div className="ring-num">{fmt(byKey['tri-verifiable']?.current ?? 0)}</div>
            <div className="ring-cap">{fmt(triTargets?.trienniumVerifiable)}h verifiable</div>
          </ProgressRing>
          <div className="ring-label">Verifiable CPD</div>
        </div>

        <div className="card ring-card">
          <ProgressRing
            value={byKey['tri-ethics']?.current ?? 0}
            max={triTargets?.ethicsVerifiablePerTriennium || 1}
            id="eth"
            from="#f59e0b"
            to="#fbbf24"
            status={ringStatus(byKey['tri-ethics'])}
          >
            <div className="ring-num">{fmt(byKey['tri-ethics']?.current ?? 0)}</div>
            <div className="ring-cap">{fmt(triTargets?.ethicsVerifiablePerTriennium)}h ethics</div>
          </ProgressRing>
          <div className="ring-label">Verifiable ethics</div>
        </div>

        <div className="card ring-card">
          <ProgressRing
            value={byKey['otj-cap']?.current ?? 0}
            max={byKey['otj-cap']?.target || 1}
            id="otj"
            from="#f43f5e"
            to="#fb7185"
            status={ringStatus(byKey['otj-cap'])}
          >
            <div className="ring-num">{fmt(byKey['otj-cap']?.current ?? 0)}</div>
            <div className="ring-cap">{fmt(byKey['otj-cap']?.target ?? 0)}h OJT</div>
          </ProgressRing>
          <div className="ring-label">On-the-job training</div>
        </div>
      </section>

      <section className="split">
        <div className="card">
          <div className="card-head">
            <h3>Requirements</h3>
            <span className="muted">Triennium to date</span>
          </div>
          <div className="rule-list">
            <div className="rule-group">Minimum per financial year</div>
            {fyChecks.map((c) => (
              <RuleRow key={c.key} check={c} />
            ))}
            <div className="rule-group rule-group--tri">Triennium-wide</div>
            {triChecks.map((c) => (
              <RuleRow key={c.key} check={c} />
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Financial years</h3>
            <span className="muted">Within this triennium</span>
          </div>
          <FYBars entries={triEntries} triennium={triennium} annualMinFor={annualMinFor} />
          {triEntries.length === 0 && (
            <div className="empty small">
              <p>No entries yet — add your first CPD activity.</p>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Recent activity</h3>
          <button className="btn btn--ghost btn--sm" onClick={() => onEdit({})}>
            <PlusIcon width={14} height={14} />
            Add entry
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="empty small">
            <p>Nothing logged yet.</p>
          </div>
        ) : (
          <div className="recent">
            {recent.map((e) => (
              <button key={e.id} className="recent-row" onClick={() => onEdit(e)}>
                <span className="dot" style={{ background: e.verifiable ? 'var(--accent)' : 'var(--muted)' }} />
                <span className="recent-title">{e.title}</span>
                <span className="recent-fy">{entryFY(e)}</span>
                <span className="recent-hours">{fmt(e.hours)}h</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}