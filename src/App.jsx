import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { getInfo, getData, saveData, deleteFile } from './api.js'
import { rulesetForTriennium } from './lib/rules.js'
import { isCurrentlyActive, currentFYLabel } from './lib/dates.js'
import {
  DashIcon,
  ListIcon,
  RulesIcon,
  ShieldIcon,
  GearIcon,
  DownloadIcon,
  PlusIcon,
  SparkIcon,
} from './components/Icons.jsx'
import Dashboard from './components/Dashboard.jsx'
import EntriesPage from './components/EntriesPage.jsx'
import RulesManager from './components/RulesManager.jsx'
import Exemptions from './components/Exemptions.jsx'
import Settings from './components/Settings.jsx'
import EntryModal from './components/EntryModal.jsx'
import ExportPage from './components/ExportPage.jsx'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: DashIcon },
  { id: 'entries', label: 'CPD Hours', icon: ListIcon },
  { id: 'rules', label: 'Rules', icon: RulesIcon },
  { id: 'exemptions', label: 'Exemptions', icon: ShieldIcon },
  { id: 'export', label: 'Export', icon: DownloadIcon },
  { id: 'settings', label: 'Settings', icon: GearIcon },
]

export default function App() {
  const [data, setData] = useState(null)
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fatal, setFatal] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [trienniumId, setTrienniumId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getInfo(), getData()])
      .then(([inf, dat]) => {
        setInfo(inf)
        setData(dat)
      })
      .catch((err) => setFatal(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const persist = useCallback(
    async (next) => {
      const previous = data
      setData(next)
      setSaving(true)
      try {
        const saved = await saveData(next)
        setData(saved)
        setToast({ type: 'ok', text: 'Saved' })
        return saved
      } catch (err) {
        setData(previous)
        setToast({ type: 'err', text: err.message })
        throw err
      } finally {
        setSaving(false)
      }
    },
    [data],
  )

  const triennium = useMemo(() => {
    if (!data) return null
    const current =
      data.trienniums.find((t) => isCurrentlyActive(t.period)) ?? data.trienniums[0]
    return trienniumId ? data.trienniums.find((t) => t.id === trienniumId) ?? current : current
  }, [data, trienniumId])

  const ruleset = useMemo(() => rulesetForTriennium(triennium, data?.rulesets || []), [triennium, data])

  const addEntry = useCallback(
    async (entry) => {
      if (!entry.trienniumId) throw new Error('Pick a triennium for this entry')
      let next = { ...data }
      if (!next.trienniums.some((t) => t.id === entry.trienniumId)) {
        next.trienniums = [
          ...next.trienniums,
          { id: entry.trienniumId, label: entry.trienniumLabel, period: entry.trienniumPeriod, rulesetId: ruleset?.id },
        ]
      }
      next.entries = [...next.entries, entry]
      await persist(next)
    },
    [data, persist, ruleset],
  )

  const updateEntry = useCallback(
    async (id, patch) => {
      const next = { ...data, entries: data.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }
      await persist(next)
    },
    [data, persist],
  )

  const setEntryStatus = useCallback(
    async (id, status) => {
      await updateEntry(id, { status })
    },
    [updateEntry],
  )

  const deleteEntry = useCallback(
    async (id) => {
      const entry = data.entries.find((e) => e.id === id)
      for (const ev of entry?.evidence || []) {
        if (ev.kind === 'file') {
          try {
            await deleteFile(ev.value)
          } catch {
            /* keep going even if evidence is already gone */
          }
        }
      }
      const next = { ...data, entries: data.entries.filter((e) => e.id !== id) }
      await persist(next)
    },
    [data, persist],
  )

  if (loading) {
    return (
      <div className="boot">
        <div className="boot-spin" />
        <p>Loading tracker…</p>
      </div>
    )
  }

  if (fatal || !data) {
    return (
      <div className="boot boot--error">
        <SparkIcon width={34} height={34} />
        <h1>Could not start the CPD tracker</h1>
        <p>{fatal}</p>
        <button className="btn btn--primary" onClick={() => location.reload()}>
          Retry
        </button>
      </div>
    )
  }

  const openNewEntry = () => setEditing({})
  const openEditEntry = (entry) => setEditing(entry)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <SparkIcon width={20} height={20} />
          </div>
          <div>
            <div className="brand-name">CPD Tracker</div>
            <div className="brand-sub">CA ANZ</div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`nav-item${tab === item.id ? ' nav-item--active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                <Icon width={17} height={17} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="foot-row">
            <span className="foot-label">Financial year</span>
            <span className="foot-value">{currentFYLabel()}</span>
          </div>
          <div className="foot-row">
            <span className="foot-label">Triennium</span>
            <span className="foot-value">{triennium?.label || '—'}</span>
          </div>
          <div className="foot-row">
            <span className="foot-label">Rule</span>
            <span className="foot-value" title={ruleset?.label}>
              {ruleset?.label || '—'}
            </span>
          </div>
          {info?.dataDir && (
            <div className="foot-path" title={info.dataDir}>
              {info.dataDir}
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1 className="page-title">{NAV.find((n) => n.id === tab)?.label}</h1>
          <div className="topbar-actions">
            <select
              className="select"
              value={trienniumId ?? ''}
              onChange={(e) => setTrienniumId(e.target.value || null)}
              title="Context triennium"
            >
              {data.trienniums.length > 1 && <option value="">Current ({triennium?.label})</option>}
              {data.trienniums.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button className="btn btn--primary" onClick={openNewEntry}>
              <PlusIcon width={16} height={16} />
              New entry
            </button>
          </div>
        </header>

        <div className="content">
          {tab === 'dashboard' && (
            <Dashboard data={data} triennium={triennium} ruleset={ruleset} onEdit={openEditEntry} />
          )}
          {tab === 'entries' && (
            <EntriesPage
              data={data}
              triennium={triennium}
              onAdd={openNewEntry}
              onEdit={openEditEntry}
              onDelete={deleteEntry}
              onStatus={setEntryStatus}
            />
          )}
          {tab === 'rules' && <RulesManager data={data} persist={persist} />}
          {tab === 'exemptions' && <Exemptions data={data} persist={persist} ruleset={ruleset} />}
          {tab === 'export' && <ExportPage data={data} />}
          {tab === 'settings' && (
            <Settings data={data} info={info} persist={persist} setTrienniumId={setTrienniumId} />
          )}
        </div>
      </main>

      {editing !== null && (
        <EntryModal
          data={data}
          entry={editing}
          ruleset={ruleset}
          triennium={triennium}
          onSave={async (entry) => {
            if (editing.id) await updateEntry(editing.id, entry)
            else await addEntry(entry)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {toast && (
        <div className={`toast toast--${toast.type}`}>
          {toast.type === 'err' ? 'Error' : '✓'} — {toast.text}
          {saving ? <span className="toast-saving"> saving…</span> : null}
        </div>
      )}
    </div>
  )
}
