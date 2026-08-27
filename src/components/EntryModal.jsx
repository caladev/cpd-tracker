import React, { useEffect, useMemo, useState } from 'react'
import { XIcon, CheckIcon, ClockIcon } from './Icons.jsx'
import EvidenceDropzone from './EvidenceDropzone.jsx'
import { deleteFile } from '../api.js'
import { fyLabelFromDate, findTrienniumForDate, trienniumPeriodFor, fyLabelsForTriennium, fyWithinTriennium } from '../lib/dates.js'
import { entryFY } from '../lib/rules.js'
import { uniqueProviders } from '../lib/entries.js'

function uid() {
  return (crypto?.randomUUID?.() ?? `e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
}

function textInput(props) {
  const { label, hint, error, ...rest } = props
  return (
    <label className={`field${error ? ' field--err' : ''}`}>
      <span className="field-label">
        {label}
        {hint ? <span className="field-hint">{hint}</span> : null}
        {error ? <span className="field-err-inline">{error}</span> : null}
      </span>
      <input className="input" {...rest} />
    </label>
  )
}

export default function EntryModal({ data, entry, ruleset, triennium, onSave, onClose }) {
  const isNew = !entry.id
  const [id] = useState(() => entry.id || uid())
  const initialEvidence = useMemo(() => [...(entry.evidence || [])], [entry])

  const providerOptions = useMemo(() => uniqueProviders(data.entries), [data.entries])

  const suggested = useMemo(() => {
    const date = entry.date
    const t = date ? findTrienniumForDate(date, data.trienniums) : null
    return t
  }, [entry.date, data.trienniums])

  const initTrienniumId =
    entry.trienniumId || suggested?.id || triennium?.id || data.trienniums[0]?.id || `t-${new Date().getFullYear()}`
  const initTri =
    data.trienniums.find((t) => t.id === initTrienniumId) || suggested || triennium || data.trienniums[0]
  const initFys = fyLabelsForTriennium(initTri)
  const initFy = entry.fy || fyLabelFromDate(entry.date) || initFys[0] || ''

  const [form, setForm] = useState(() => ({
    title: entry.title || entry.activity || '',
    provider: entry.provider || '',
    hours: entry.hours ?? '',
    date: entry.date || '',
    undated: !entry.date,
    fy: initFy,
    trienniumId: initTrienniumId,
    status: entry.status || 'Actual',
    verifiable: entry.verifiable ?? true,
    onTheJob: entry.onTheJob ?? false,
    ethicsHours: entry.ethicsHours ?? '',
    specialisation: entry.specialisation ?? false,
    relevance: entry.relevance === 'No' ? 'No' : entry.relevance || 'Yes',
    notes: entry.notes || '',
    evidence: initialEvidence,
  }))

  const [errors, setErrors] = useState({})
  const cleanupRef = React.useRef(null)

  useEffect(() => {
    return () => {
      if (isNew && cleanupRef.current) {
        for (const ev of cleanupRef.current) {
          if (ev.kind === 'file') deleteFile(ev.value).catch(() => {})
        }
      }
    }
  }, [isNew])

  const triOptions = useMemo(() => {
    const opts = data.trienniums.map((t) => ({ ...t, derived: false }))
    const live = form.date ? findTrienniumForDate(form.date, data.trienniums) : suggested
    if (live?.new) opts.push({ ...live, derived: true })
    if (!opts.some((o) => o.id === form.trienniumId)) {
      const fallback = triennium || data.trienniums[0]
      if (fallback && !opts.some((o) => o.id === fallback.id)) opts.push({ ...fallback, derived: true })
    }
    return opts
  }, [data.trienniums, suggested, form.date, form.trienniumId, triennium])

  const selectedTri = useMemo(() => triOptions.find((o) => o.id === form.trienniumId), [triOptions, form.trienniumId])

  const fyOptions = useMemo(() => fyLabelsForTriennium(selectedTri), [selectedTri])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const changeDate = (date) => {
    if (!date) {
      set({ date: '', undated: true })
      return
    }
    const f = fyLabelFromDate(date) || ''
    const t = findTrienniumForDate(date, data.trienniums)
    set({ date, fy: f, trienniumId: t.id, undated: false })
  }

  const changeTriennium = (tid) => {
    const t = triOptions.find((o) => o.id === tid)
    const f = form.date ? fyLabelFromDate(form.date) : null
    set({ trienniumId: tid, fy: fyWithinTriennium(t, f) })
  }

  const changeFy = (fy) => set({ fy })

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.title.trim()) errs.title = 'A short description is required'
    const hours = Number(form.hours)
    if (!form.hours || Number.isNaN(hours) || hours <= 0) errs.hours = 'Enter a positive number of hours'
    const ethics = form.ethicsHours === '' || form.ethicsHours === null ? 0 : Number(form.ethicsHours)
    if (Number.isNaN(ethics) || ethics < 0) errs.ethicsHours = 'Hours must be ≥ 0'
    if (ethics > hours && !errs.hours) errs.ethicsHours = 'Ethics hours can’t exceed the total hours'
    if (!form.fy) errs.fy = 'Pick a financial year'
    if (!form.trienniumId) errs.trienniumId = 'Pick a triennium'
    setErrors(errs)
    if (Object.keys(errs).length) return

    const selected = triOptions.find((t) => t.id === form.trienniumId)
    const entry = {
      id,
      trienniumId: form.trienniumId,
      trienniumLabel: selected?.label,
      trienniumPeriod: selected?.period,
      fy: form.fy,
      status: form.status,
      date: form.undated ? null : form.date || null,
      title: form.title.trim(),
      provider: form.provider.trim(),
      hours: Math.round(hours * 100) / 100,
      relevance: form.relevance.trim() || 'Yes',
      verifiable: form.verifiable,
      onTheJob: form.onTheJob,
      ethicsHours: Math.round(ethics * 100) / 100,
      specialisation: form.specialisation,
      evidence: form.evidence,
      notes: form.notes.trim(),
    }
    cleanupRef.current = isNew ? form.evidence : null
    await onSave(entry)
    cleanupRef.current = null
  }

  const toggle = (key, on) => (
    <button
      type="button"
      className={`switch${on ? ' switch--on' : ''}`}
      role="switch"
      aria-checked={on}
      onClick={() => set({ [key]: !on })}
    >
      <span className="switch-knob" />
    </button>
  )

  const chosenTri = triOptions.find((t) => t.id === form.trienniumId)

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <header className="modal-head">
          <h2>{isNew ? 'New CPD entry' : 'Edit CPD entry'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <XIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal-body">
          <div className="seg">
            <button
              type="button"
              className={form.status === 'Actual' ? 'seg-btn seg-btn--on' : 'seg-btn'}
              onClick={() => set({ status: 'Actual' })}
            >
              <CheckIcon width={15} height={15} />
              Actual
            </button>
            <button
              type="button"
              className={form.status === 'Draft' ? 'seg-btn seg-btn--on seg-btn--draft' : 'seg-btn'}
              onClick={() => set({ status: 'Draft' })}
            >
              <ClockIcon width={15} height={15} />
              Draft
            </button>
          </div>

          <div className="form-grid">
            {textInput({
              label: 'Activity',
              placeholder: 'e.g. YOW! Conference 2026 Day 1',
              value: form.title,
              onChange: (e) => set({ title: e.target.value }),
              autoFocus: true,
              error: errors.title,
            })}
            {textInput({
              label: 'Provider',
              placeholder: 'e.g. Trifork / Goto',
              hint: providerOptions.length
                ? `${providerOptions.length} recorded ${providerOptions.length === 1 ? 'provider' : 'providers'} to pick from`
                : undefined,
              list: 'cpd-provider-options',
              value: form.provider,
              onChange: (e) => set({ provider: e.target.value }),
            })}
            {textInput({
              label: 'Hours',
              type: 'number',
              step: '0.25',
              min: '0',
              placeholder: '0.0',
              value: form.hours,
              onChange: (e) => set({ hours: e.target.value }),
              error: errors.hours,
            })}
            {textInput({
              label: 'Ethics hours',
              hint: 'subset of hours',
              type: 'number',
              step: '0.25',
              min: '0',
              placeholder: '0',
              value: form.ethicsHours,
              onChange: (e) => set({ ethicsHours: e.target.value }),
              error: errors.ethicsHours,
            })}
            {textInput({
              label: 'Date',
              type: 'date',
              value: form.date,
              onChange: (e) => changeDate(e.target.value),
            })}

            <label className={`field${errors.fy ? ' field--err' : ''}`}>
              <span className="field-label">
                Financial year
                {errors.fy ? <span className="field-err-inline">{errors.fy}</span> : null}
              </span>
              <select className="select" value={form.fy} onChange={(e) => changeFy(e.target.value)}>
                {fyOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field checkbox">
            <input
              type="checkbox"
              checked={form.undated}
              onChange={(e) => {
                const on = e.target.checked
                set({ undated: on, date: on ? '' : form.date })
              }}
            />
            No specific date (e.g. technical reading accrued through the year)
          </label>

          <datalist id="cpd-provider-options">
            {providerOptions.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          <label className="field">
            <span className="field-label">
              Triennium
              {errors.trienniumId ? <span className="field-err-inline">{errors.trienniumId}</span> : null}
            </span>
            <select
              className="select"
              value={form.trienniumId}
              onChange={(e) => changeTriennium(e.target.value)}
            >
              {triOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} {t.derived ? '· new' : ''}
                </option>
              ))}
            </select>
            <span className="field-hint">
              {chosenTri?.period ? `Covers ${chosenTri.period.start} → ${chosenTri.period.end}` : 'Will be created when saved'}
            </span>
          </label>

          <label className="field">
            <span className="field-label">Relevance to current / future professional development</span>
            <select className="select" value={form.relevance} onChange={(e) => set({ relevance: e.target.value })}>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
              {form.relevance !== 'Yes' && form.relevance !== 'No' && form.relevance ? (
                <option value={form.relevance}>Keep: {form.relevance}</option>
              ) : null}
            </select>
          </label>

          <div className="field">
            <span className="field-label">Evidence</span>
            <EvidenceDropzone
              entryId={id}
              evidence={form.evidence}
              onChange={(evidence) => set({ evidence })}
            />
          </div>

          <label className="field">
            <span className="field-label">Notes</span>
            <textarea
              className="input textarea"
              rows="2"
              placeholder="Optional notes…"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </label>

          <div className="toggles">
            {[
              ['Verifiable CPD', form.verifiable, 'verifiable'],
              ['On-the-job training', form.onTheJob, 'onTheJob'],
              ['Relates to accounting specialisations', form.specialisation, 'specialisation'],
            ].map(([label, on, key]) => (
              <div key={key} className="toggle-row">
                <span>{label}</span>
                {toggle(key, on)}
              </div>
            ))}
          </div>
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            {isNew ? 'Add entry' : 'Save changes'}
          </button>
        </footer>
      </form>
    </div>
  )
}