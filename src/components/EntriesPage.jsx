import React, { useMemo, useState, useEffect } from 'react'
import { EditIcon, TrashIcon, EyeIcon, LinkIcon, PlusIcon, CalendarIcon, ArrowUp, XIcon } from './Icons.jsx'
import { entriesForTriennium, totalsForEntries, entryFY } from '../lib/rules.js'
import { assetUrl } from '../api.js'

const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('en-AU')

function EvidenceChips({ evidence }) {
  const list = evidence || []
  if (!list.length) return <span className="muted">—</span>
  return (
    <div className="evidence-chips">
      {list.map((ev, i) =>
        ev.kind === 'url' ? (
          <a
            key={i}
            className="chip chip--link"
            href={ev.value}
            target="_blank"
            rel="noreferrer"
            title={ev.value}
          >
            <LinkIcon width={12} height={12} />
            link
          </a>
        ) : (
          <a key={i} className="chip" href={assetUrl(ev.value)} target="_blank" rel="noreferrer" title={ev.value}>
            <EyeIcon width={12} height={12} />
            evidence
          </a>
        ),
      )}
    </div>
  )
}

export default function EntriesPage({ data, triennium, onAdd, onEdit, onDelete, onStatus }) {
  const [fy, setFy] = useState('all')
  const [status, setStatus] = useState('all')
  const [verifiable, setVerifiable] = useState('all')
  const [q, setQ] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  useEffect(() => {
    if (!confirmId) return
    const t = setTimeout(() => setConfirmId(null), 3500)
    return () => clearTimeout(t)
  }, [confirmId])

  const base = useMemo(
    () => (triennium ? entriesForTriennium(data.entries, triennium.id) : data.entries),
    [data.entries, triennium],
  )

  const fyOptions = useMemo(() => {
    const s = new Set(base.map((e) => entryFY(e)).filter(Boolean))
    return [...s].sort()
  }, [base])

  const rows = useMemo(() => {
    return base.filter((e) => {
      if (fy !== 'all' && entryFY(e) !== fy) return false
      if (status !== 'all' && e.status !== status) return false
      if (verifiable !== 'all' && e.verifiable !== (verifiable === 'yes')) return false
      if (q) {
        const hay = [e.title, e.provider, e.relevance, e.notes, e.activity || '']
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [base, fy, status, verifiable, q])

  const totals = useMemo(() => totalsForEntries(rows), [rows])

  return (
    <div>
      <div className="toolbar">
        <input
          className="input search"
          placeholder="Search activities, providers…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="select" value={fy} onChange={(e) => setFy(e.target.value)}>
          <option value="all">All financial years</option>
          {fyOptions.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Actual + Draft</option>
          <option value="Actual">Actual</option>
          <option value="Draft">Draft</option>
        </select>
        <select className="select" value={verifiable} onChange={(e) => setVerifiable(e.target.value)}>
          <option value="all">All types</option>
          <option value="yes">Verifiable</option>
          <option value="no">Non-verifiable</option>
        </select>
      </div>

      <div className="card table-card">
        {rows.length === 0 ? (
          <div className="empty">
            <CalendarIcon width={30} height={30} />
            <h3>No entries match</h3>
            <p>Adjust filters or add a new CPD activity.</p>
            <button className="btn btn--primary" onClick={onAdd}>
              <PlusIcon width={15} height={15} />
              New entry
            </button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>FY</th>
                <th>Type</th>
                <th>Activity</th>
                <th>Provider</th>
                <th className="num">Hours</th>
                <th>Verif.</th>
                <th className="num">Ethics</th>
                <th>OJT</th>
                <th>Evidence</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="muted cell-dim">{e.date || '—'}</td>
                  <td>
                    <span className="tag">{entryFY(e) || '—'}</span>
                  </td>
                  <td>
                    <span className={`badge badge--${e.status === 'Draft' ? 'draft' : 'actual'}`}>{e.status}</span>
                  </td>
                  <td className="cell-main">
                    <div className="cell-title">{e.title}</div>
                    {e.specialisation ? <div className="cell-sub">Specialisation-related</div> : null}
                  </td>
                  <td className="muted">{e.provider || '—'}</td>
                  <td className="num cell-hours">{fmt(e.hours)}</td>
                  <td>{e.verifiable ? <span className="dot dot--on" /> : <span className="dot" />}</td>
                  <td className="num muted">{e.ethicsHours ? fmt(e.ethicsHours) : '—'}</td>
                  <td>{e.onTheJob ? <span className="tag tag--otj">OJT</span> : <span className="muted">—</span>}</td>
                  <td>
                    <EvidenceChips evidence={e.evidence} />
                  </td>
                  <td className="num">
                    <div className="row-actions">
                      {e.status === 'Draft' && (
                        <button
                          className="icon-btn icon-btn--promote"
                          title="Mark as Actual"
                          onClick={() => onStatus(e.id, 'Actual')}
                        >
                          <ArrowUp width={16} height={16} />
                        </button>
                      )}
                      <button className="icon-btn" title="Edit" onClick={() => onEdit(e)}>
                        <EditIcon width={16} height={16} />
                      </button>
                      {confirmId === e.id ? (
                        <button
                          className="icon-btn icon-btn--danger icon-btn--confirm"
                          title="Confirm delete"
                          onClick={() => {
                            setConfirmId(null)
                            onDelete(e.id)
                          }}
                        >
                          <XIcon width={15} height={15} />
                        </button>
                      ) : (
                        <button
                          className="icon-btn icon-btn--danger"
                          title="Delete"
                          onClick={() => setConfirmId(e.id)}
                        >
                          <TrashIcon width={16} height={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="muted">
                  {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
                </td>
                <td className="num cell-hours strong">{fmt(totals.hours)}</td>
                <td />
                <td className="num strong">{fmt(totals.ethics)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}