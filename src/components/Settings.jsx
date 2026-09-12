import React, { useMemo, useState } from 'react'
import { PlusIcon, TrashIcon, CheckIcon } from './Icons.jsx'
import { createDefaultData } from '../lib/defaults.js'
import { entriesForTriennium, activeRulesetForDate } from '../lib/rules.js'
import { trienniumPeriodFor, trienniumLabelFor } from '../lib/dates.js'

export default function Settings({ data, info, persist, setTrienniumId }) {
  const [startYear, setStartYear] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  const addTriennium = () => {
    const y = Number(startYear)
    if (!y || y < 2000) return
    const id = `t-${y}`
    if (data.trienniums.some((t) => t.id === id)) {
      alert('That triennium already exists.')
      return
    }
    const period = trienniumPeriodFor(y)
    const rs = activeRulesetForDate(period.start, data.rulesets)
    persist({
      ...data,
      trienniums: [
        ...data.trienniums,
        { id, label: trienniumLabelFor(y), period, rulesetId: rs?.id },
      ],
    })
    setStartYear('')
    setTrienniumId(id)
  }

  const removeTriennium = async (t) => {
    const used = entriesForTriennium(data.entries, t.id).length
    if (used) {
      alert(`${t.label} has ${used} entries — move or delete them first.`)
      return
    }
    const rest = data.trienniums.filter((x) => x.id !== t.id)
    await persist({ ...data, trienniums: rest })
    if (rest.length) setTrienniumId(rest[rest.length - 1].id)
  }

  const reset = async () => {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    await persist(createDefaultData())
    setConfirmReset(false)
  }

  const current = useMemo(() => new Date().toISOString().slice(0, 10), [])

  return (
    <div>
      <div className="hero">
        <div>
          <h2 className="hero-title">Settings</h2>
          <p className="hero-sub">Storage, trienniums, imports — the application's infrastructure.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Storage</h3>
        </div>
        <div className="kv">
          <div className="kv-row">
            <span>Data directory</span>
            <code>{info?.dataDir}</code>
          </div>
          <div className="kv-row">
            <span>Database file</span>
            <code>{info?.dbFile}</code>
          </div>
          <div className="kv-row">
            <span>Entries</span>
            <code>{info?.entryCount}</code>
          </div>
          <div className="kv-row">
            <span>Persisted to disk</span>
            <code>{info?.persisted ? <CheckIcon width={14} height={14} /> : 'no'}</code>
          </div>
        </div>
        <p className="muted note">
          Set <code>CPD_DATA_DIR</code> to override this location. Files are written atomically.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Trienniums</h3>
          <span className="muted">1 July – 30 June cycles</span>
        </div>
        <div className="tri-list">
          {data.trienniums.map((t) => (
            <div key={t.id} className="tri-row">
              <span className="tag">{t.label}</span>
              <span className="muted">
                {t.period?.start} → {t.period?.end}
              </span>
              <span className="muted">
                {entriesForTriennium(data.entries, t.id).length} entries
              </span>
              <button
                className="icon-btn icon-btn--danger"
                title={`Remove ${t.label}`}
                onClick={() => removeTriennium(t)}
              >
                <TrashIcon width={15} height={15} />
              </button>
            </div>
          ))}
        </div>
        <div className="url-add">
          <input
            className="input"
            type="number"
            min="2000"
            placeholder="Start year, e.g. 2029"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
          />
          <button className="btn btn--ghost btn--sm" onClick={addTriennium}>
            <PlusIcon width={14} height={14} />
            Add triennium
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Danger zone</h3>
        </div>
        <div className="btn-row">
          <button className="btn btn--danger" onClick={reset}>
            {confirmReset ? 'Click again to confirm reset' : 'Reset to fresh tracker'}
          </button>
        </div>
        <p className="muted note">
          Replaces <code>cpd_data.db</code> with a new empty dataset for today ({current}). Evidence
          files are left on disk.
        </p>
      </div>
    </div>
  )
}
