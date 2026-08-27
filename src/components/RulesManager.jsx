import React, { useEffect, useMemo, useRef, useState } from 'react'
import { PlusIcon, TrashIcon, EyeIcon, SparkIcon, UploadIcon } from './Icons.jsx'
import { uploadFile, assetUrl } from '../api.js'
import { currentRuleset } from '../lib/rules.js'

function tryNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function RuleCard({ rule, active, onChange, onDelete }) {
  const fileRef = useRef(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const valid = rule.period?.start && rule.label

  const set = (patch) => onChange({ ...rule, ...patch })

  const uploadPdf = async (file) => {
    setPdfBusy(true)
    try {
      const res = await uploadFile(file, 'rules', rule.id)
      set({ regulationPdf: res.value })
    } catch (err) {
      alert(`Upload failed: ${err.message}`)
    } finally {
      setPdfBusy(false)
    }
  }

  const num = (key) => (
    <input
      className="input input--num"
      type="number"
      step="0.5"
      min="0"
      value={rule.targets?.[key] ?? ''}
      onChange={(e) =>
        set({ targets: { ...rule.targets, [key]: tryNum(e.target.value) } })
      }
    />
  )

  return (
    <div className={`card rule-card${active ? ' rule-card--active' : ''}`}>
      <div className="rule-card-head">
        <div className="rule-card-id">
          {active && <span className="badge badge--actual">Active now</span>}
          <h3>{rule.label}</h3>
          <span className="muted">
            {rule.period?.start || '—'} → {rule.period?.end || 'current'}
          </span>
        </div>
        <button className="icon-btn icon-btn--danger" title="Delete ruleset" onClick={() => onDelete(rule.id)}>
          <TrashIcon width={16} height={16} />
        </button>
      </div>

      <div className="form-grid rule-meta">
        <label className="field">
          <span className="field-label">Label</span>
          <input
            className="input"
            value={rule.label}
            onChange={(e) => set({ label: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field-label">Member type</span>
          <select className="select" value={rule.memberType} onChange={(e) => set({ memberType: e.target.value })}>
            {['CA', 'ACA', 'AT', 'Affiliate'].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Applies from</span>
          <input
            className="input"
            type="date"
            value={rule.period?.start || ''}
            onChange={(e) => set({ period: { ...rule.period, start: e.target.value } })}
          />
        </label>
        <label className="field">
          <span className="field-label">Applies until</span>
          <input
            className="input"
            type="date"
            value={rule.period?.end || ''}
            onChange={(e) => set({ period: { ...rule.period, end: e.target.value || null } })}
          />
        </label>
      </div>

      <div className="rule-targets">
        <span className="field-label">Targets</span>
        <div className="targets-grid">
          <label className="target-field">
            <span>Annual min CPD (hrs)</span>
            {num('annualMinCpd')}
          </label>
          <label className="target-field">
            <span>Triennium total (hrs)</span>
            {num('trienniumMinCpd')}
          </label>
          <label className="target-field">
            <span>Verifiable per triennium (hrs)</span>
            {num('trienniumVerifiable')}
          </label>
          <label className="target-field">
            <span>Verifiable ethics (hrs)</span>
            {num('ethicsVerifiablePerTriennium')}
          </label>
          <label className="target-field">
            <span>OJT max fraction of verifiable</span>
            {num('otjMaxFractionOfVerifiable')}
          </label>
          <label className="target-field">
            <span>Non-verifiable cap (hrs)</span>
            {num('nonVerifiableCapPerTriennium')}
          </label>
        </div>
      </div>

      <div className="rule-pdf">
        <span className="field-label">Regulation PDF</span>
        {rule.regulationPdf ? (
          <div className="ev-item">
            <SparkIcon width={15} height={15} />
            <a className="ev-value" href={assetUrl(rule.regulationPdf)} target="_blank" rel="noreferrer">
              <EyeIcon width={13} height={13} />
              {rule.regulationPdf.split('/').pop()}
            </a>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => fileRef.current?.click()}
              disabled={pdfBusy}
            >
              <UploadIcon width={13} height={13} />
              {pdfBusy ? 'Uploading…' : 'Replace'}
            </button>
          </div>
        ) : (
          <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()} disabled={pdfBusy}>
            <UploadIcon width={14} height={14} />
            {pdfBusy ? 'Uploading…' : 'Upload PDF'}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            if (e.target.files[0]) uploadPdf(e.target.files[0])
            e.target.value = ''
          }}
        />
      </div>

      <label className="field">
        <span className="field-label">Notes</span>
        <textarea
          className="input textarea"
          rows="2"
          value={rule.notes || ''}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Reference / summary of the regulation…"
        />
      </label>

      {!valid && <div className="field-err">Give it a label and an applicable-from date before saving.</div>}
    </div>
  )
}

export default function RulesManager({ data, persist }) {
  const [rules, setRules] = useState(() => data.rulesets.map((r) => ({ ...r, targets: { ...r.targets } })))
  const [saved, setSaved] = useState(true)
  const active = currentRuleset(rules)

  useEffect(() => {
    setSaved(JSON.stringify(rules) === JSON.stringify(data.rulesets.map((r) => ({ ...r, targets: { ...r.targets } }))))
  }, [rules, data.rulesets])

  const add = () => {
    const base = active?.targets || {}
    setRules([
      ...rules,
      {
        id: `rs-${Date.now()}`,
        label: 'New ruleset',
        period: { start: '', end: null },
        memberType: active?.memberType || 'CA',
        regulationPdf: null,
        targets: { ...base },
        notes: '',
      },
    ])
  }

  const remove = (id) => {
    const inUse = data.trienniums.some((t) => t.rulesetId === id)
    if (inUse) {
      alert('This ruleset is attached to a triennium. Change the triennium first.')
      return
    }
    setRules(rules.filter((r) => r.id !== id))
  }

  const save = async () => {
    try {
      await persist({ ...data, rulesets: rules })
      setSaved(true)
    } catch (err) {
      alert(err.message)
    }
  }

  const count = useMemo(() => rules.filter((r) => r.period?.start && r.label).length, [rules])

  return (
    <div>
      <div className="hero">
        <div>
          <h2 className="hero-title">CPD rules per period</h2>
          <p className="hero-sub">
            Each periodic rule configuration tracks its own regulation PDF and targets. When rules
            change, add a new one — past trienniums keep the rules they were recorded under.
          </p>
        </div>
        <button className="btn btn--ghost" onClick={add}>
          <PlusIcon width={16} height={16} />
          Add ruleset
        </button>
      </div>

      <div className="stack">
        {rules.map((r) => (
          <RuleCard
            key={r.id}
            rule={r}
            active={active?.id === r.id}
            onChange={(next) => {
              setRules(rules.map((x) => (x.id === r.id ? next : x)))
            }}
            onDelete={remove}
          />
        ))}
      </div>

      <div className="sticky-bar">
        <span className="muted">
          {count} ruleset{count === 1 ? '' : 's'} · rules apply per triennium
        </span>
        <button className="btn btn--primary" onClick={save} disabled={saved}>
          {saved ? 'Saved' : 'Save rules'}
        </button>
      </div>
    </div>
  )
}