import React, { useState } from 'react'
import { DownloadIcon } from './Icons.jsx'
import { currentExportTriennium } from '../lib/exportScope.js'

function download(path) {
  const link = document.createElement('a')
  link.href = `/api/export${path}`
  link.click()
}

export default function ExportPage({ data }) {
  const [includeEvidence, setIncludeEvidence] = useState(true)
  const [trienniumId, setTrienniumId] = useState(() => currentExportTriennium(data.trienniums))
  const selected = data.trienniums.find((t) => t.id === trienniumId)
  const count = data.entries.filter((entry) => entry.trienniumId === trienniumId).length
  const exportReport = (report) => download(`/${report}?${new URLSearchParams({ trienniumId, includeEvidence: String(includeEvidence) })}`)

  return (
    <div className="export-page">
      <div className="hero">
        <div>
          <h2 className="hero-title">Export your CPD records</h2>
          <p className="hero-sub">{selected ? `Export ${count} entries for ${selected.label}, including Actual and Draft entries.` : 'Select a triennium to export.'}</p>
        </div>
      </div>

      <div className="toolbar">
        <label className="field">
          <span className="field-label">Export triennium</span>
          <select className="select" value={trienniumId} onChange={(event) => setTrienniumId(event.target.value)}>
            {!selected && <option value="">Select a triennium</option>}
            {data.trienniums.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <div className="export-grid">
        <section className="card summary-card export-card">
          <div className="card-head">
            <h3>Summary report</h3>
            <span className="tag">CSV</span>
          </div>
          <p>Totals grouped by triennium, financial year, and Actual or Draft status.</p>
          <button type="button" className="btn btn--ghost" disabled={!selected} onClick={() => exportReport('summary')}>
            <DownloadIcon width={15} height={15} />
            Download CSV
          </button>
        </section>

        <section className="card summary-card export-card">
          <div className="card-head">
            <h3>Detailed report</h3>
            <span className="tag">CSV</span>
          </div>
          <p>One row per entry, including hours, classifications, notes, and evidence references.</p>
          <button type="button" className="btn btn--ghost" disabled={!selected} onClick={() => exportReport('detail')}>
            <DownloadIcon width={15} height={15} />
            Download CSV
          </button>
        </section>
      </div>

      <section className="card summary-card export-archive">
        <div className="card-head">
          <h3>Complete export archive</h3>
          <span className="tag">ZIP</span>
        </div>
        <p>Includes both CSV reports{includeEvidence ? ' and the associated evidence files.' : '.'}</p>
        <div className="export-actions">
        <label className="field checkbox">
          <input type="checkbox" checked={includeEvidence} onChange={(event) => setIncludeEvidence(event.target.checked)} />
          Include evidence files
        </label>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!selected}
          onClick={() => exportReport('archive')}
        >
          <DownloadIcon width={16} height={16} />
          Download ZIP
        </button>
        </div>
      </section>
    </div>
  )
}
