// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createDefaultData } from '../lib/defaults.js'
import EntryModal from './EntryModal.jsx'
import EvidenceDropzone from './EvidenceDropzone.jsx'
import ExportPage from './ExportPage.jsx'
import Dashboard from './Dashboard.jsx'
import EntriesPage from './EntriesPage.jsx'
import Settings from './Settings.jsx'
import Exemptions from './Exemptions.jsx'
import RulesManager from './RulesManager.jsx'
import { deleteFile, uploadFile } from '../api.js'

vi.mock('../api.js', () => ({ deleteFile: vi.fn(), uploadFile: vi.fn(), assetUrl: (p) => `/api/file?path=${encodeURIComponent(p)}` }))
const h = React.createElement
let data
beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-13T00:00:00Z'))
  data = createDefaultData(new Date('2026-08-21T00:00:00Z'))
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
const entry = (patch = {}) => ({ id: 'one', trienniumId: 't-2026', fy: 'FY27', title: 'Ethics workshop', date: '2026-08-21', hours: 2, ethicsHours: 1, status: 'Actual', verifiable: true, evidence: [], ...patch })
function modal(e = {}, props = {}) {
  return render(h(EntryModal, { data, entry: e, triennium: data.trienniums[0], ruleset: data.rulesets[0], onSave: vi.fn(), onClose: vi.fn(), ...props }))
}

describe('entry editing and evidence regressions', () => {
  it('validates required fields and rejects ethics hours above total hours', async () => {
    const save = vi.fn()
    const view = modal({}, { onSave: save })
    fireEvent.submit(view.container.querySelector('form'))
    expect(screen.getByText('A short description is required')).toBeTruthy()
    expect(screen.getByText('Enter a positive number of hours')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/^Activity/), { target: { value: 'Course' } })
    fireEvent.change(screen.getByLabelText(/^Hours/), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/^Ethics hours/), { target: { value: '2' } })
    fireEvent.submit(view.container.querySelector('form'))
    expect(screen.getByText('Ethics hours can’t exceed the total hours')).toBeTruthy()
    expect(save).not.toHaveBeenCalled()
  })
  it('saves edits with rounded hours and draft status, without losing evidence', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const ev = [{ kind: 'url', value: 'https://example.org' }]
    const view = modal(entry({ evidence: ev }), { onSave: save })
    fireEvent.change(screen.getByLabelText(/^Activity/), { target: { value: ' Updated course ' } })
    fireEvent.change(screen.getByLabelText(/^Hours/), { target: { value: '2.126' } })
    await userEvent.click(screen.getByRole('button', { name: 'Draft', exact: true }))
    fireEvent.submit(view.container.querySelector('form'))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'one', title: 'Updated course', status: 'Draft', hours: 2.13, evidence: ev })))
  })
  it.each(['file', 'url'])('removes %s evidence without submitting or closing the modal', async (kind) => {
    const save = vi.fn(), close = vi.fn()
    deleteFile.mockResolvedValue({ ok: true })
    modal(entry({ evidence: [{ kind, value: 'evidence/one/a.pdf' }] }), { onSave: save, onClose: close })
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull())
    expect(save).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled()
    expect(deleteFile).toHaveBeenCalledTimes(kind === 'file' ? 1 : 0)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ evidence: [] }))
  })
  it('supports cancelling without saving and derives the FY when changing dates', async () => {
    const save = vi.fn(), close = vi.fn()
    const view = modal(entry(), { onSave: save, onClose: close })
    fireEvent.change(screen.getByLabelText('Date', { exact: true }), { target: { value: '2029-07-01' } })
    expect(screen.getByLabelText('Financial year').value).toBe('FY30')
    fireEvent.submit(view.container.querySelector('form'))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ trienniumId: 't-2029', fy: 'FY30', date: '2029-07-01' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(close).toHaveBeenCalledOnce()
  })
  it('appends uploaded evidence and surfaces upload failures', async () => {
    const onChange = vi.fn()
    const existing = [{ kind: 'url', value: 'https://example.org' }]
    const view = render(h(EvidenceDropzone, { entryId: 'one', evidence: existing, onChange }))
    const file = new File(['PDF'], 'certificate.pdf', { type: 'application/pdf' })
    uploadFile.mockResolvedValue({ value: 'evidence/one/certificate.pdf', filename: 'certificate.pdf', size: 3 })
    await userEvent.upload(view.container.querySelector('input[type=file]'), file)
    expect(onChange).toHaveBeenCalledWith([existing[0], expect.objectContaining({ kind: 'file', filename: 'certificate.pdf' })])
    uploadFile.mockRejectedValue(new Error('Upload unavailable'))
    await userEvent.upload(view.container.querySelector('input[type=file]'), file)
    expect(await screen.findByText('Upload unavailable')).toBeTruthy()
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('exports and recent activity', () => {
  it('defaults to the current period and sends the selection and evidence option to every download', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-21T00:00:00Z'))
    data.trienniums.unshift({ id: 't-2023', label: '2023-2026', period: { start: '2023-07-01', end: '2026-06-30' } })
    data.entries = [entry(), entry({ id: 'old', trienniumId: 't-2023' })]
    const urls = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { urls.push(new URL(this.href)) })
    render(h(ExportPage, { data }))
    const select = screen.getByLabelText('Export triennium')
    expect(select.value).toBe('t-2026')
    fireEvent.change(select, { target: { value: 't-2023' } })
    screen.getAllByRole('button', { name: 'Download CSV' }).forEach((button) => fireEvent.click(button))
    fireEvent.click(screen.getByLabelText('Include evidence files'))
    fireEvent.click(screen.getByRole('button', { name: 'Download ZIP' }))
    expect(urls.map((url) => url.pathname)).toEqual(['/api/export/summary', '/api/export/detail', '/api/export/archive'])
    expect(urls.every((url) => url.searchParams.get('trienniumId') === 't-2023')).toBe(true)
    expect(urls[2].searchParams.get('includeEvidence')).toBe('false')
  })
  it('disables exports when no current period exists until one is chosen', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2040-01-01T00:00:00Z'))
    render(h(ExportPage, { data }))
    expect(screen.getAllByRole('button').every((button) => button.disabled)).toBe(true)
    fireEvent.change(screen.getByLabelText('Export triennium'), { target: { value: 't-2026' } })
    expect(screen.getAllByRole('button').every((button) => !button.disabled)).toBe(true)
  })
  it('shows Australian long dates, Actual/Draft status and undated entries; opens the selected activity', async () => {
    data.entries = [entry(), entry({ id: 'two', title: 'Planned course', status: 'Draft', date: null })]
    const onEdit = vi.fn()
    render(h(Dashboard, { data, triennium: data.trienniums[0], ruleset: data.rulesets[0], onEdit }))
    const actual = screen.getByRole('button', { name: /Ethics workshop\s*21 August 2026\s*FY27\s*Actual\s*2h/ })
    expect(screen.getByRole('button', { name: /Planned course\s*Undated\s*FY27\s*Draft\s*2h/ })).toBeTruthy()
    await userEvent.click(actual)
    expect(onEdit).toHaveBeenCalledWith(data.entries[0])
  })
})

describe('CPD Hours and administration', () => {
  it('filters activities, supports draft promotion, editing and confirmed deletion', async () => {
    data.entries = [entry(), entry({ id: 'two', title: 'Reading', status: 'Draft', verifiable: false }), entry({ id: 'old', title: 'Other period', trienniumId: 't-2023' })]
    const onEdit = vi.fn(), onDelete = vi.fn(), onStatus = vi.fn()
    render(h(EntriesPage, { data, triennium: data.trienniums[0], onEdit, onDelete, onStatus }))
    expect(screen.queryByText('Other period')).toBeNull()
    const search = screen.getByPlaceholderText('Search activities, providers…')
    await userEvent.type(search, 'reading')
    expect(screen.queryByText('Ethics workshop')).toBeNull()
    await userEvent.click(screen.getByTitle('Mark as Actual'))
    expect(onStatus).toHaveBeenCalledWith('two', 'Actual')
    await userEvent.click(screen.getByTitle('Edit'))
    expect(onEdit).toHaveBeenCalledWith(data.entries[1])
    await userEvent.click(screen.getByTitle('Delete'))
    expect(onDelete).not.toHaveBeenCalled()
    await userEvent.click(screen.getByTitle('Confirm delete'))
    expect(onDelete).toHaveBeenCalledWith('two')
    await userEvent.clear(search)
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'FY27' } })
    fireEvent.change(selects[1], { target: { value: 'Actual' } })
    fireEvent.change(selects[2], { target: { value: 'yes' } })
    expect(screen.queryByText('Reading')).toBeNull()
    expect(screen.getByText('Ethics workshop')).toBeTruthy()
  })
  it('adds trienniums, rejects duplicates and requires confirmation before reset', async () => {
    const persist = vi.fn().mockResolvedValue(undefined), setTrienniumId = vi.fn()
    render(h(Settings, { data, info: {}, persist, setTrienniumId }))
    const input = screen.getByPlaceholderText('Start year, e.g. 2029')
    fireEvent.change(input, { target: { value: '2026' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add triennium' }))
    expect(persist).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '2029' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add triennium' }))
    expect(persist.mock.calls[0][0].trienniums.at(-1)).toMatchObject({ id: 't-2029', period: { start: '2029-07-01', end: '2032-06-30' } })
    persist.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Reset to fresh tracker' }))
    expect(persist).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Click again to confirm reset' }))
    expect(persist.mock.calls[0][0].entries).toEqual([])
  })
  it('adds and removes an exemption and persists the edited list', async () => {
    const persist = vi.fn().mockResolvedValue(undefined)
    render(h(Exemptions, { data, ruleset: data.rulesets[0], persist }))
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Leave' } })
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-07-01' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-12-31' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add exemption' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save exemptions' }))
    expect(persist.mock.calls[0][0].exemptions[0]).toMatchObject({ label: 'Leave', period: { start: '2026-07-01', end: '2026-12-31' } })
    await userEvent.click(screen.getByTitle('Remove exemption'))
    expect(screen.getByText(/No exemptions yet/)).toBeTruthy()
  })
  it('edits rule targets and protects a ruleset attached to a triennium', async () => {
    const persist = vi.fn().mockResolvedValue(undefined)
    render(h(RulesManager, { data, persist }))
    await userEvent.click(screen.getByTitle('Delete ruleset'))
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('attached to a triennium'))
    fireEvent.change(screen.getByLabelText('Annual min CPD (hrs)'), { target: { value: '25' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save rules' }))
    expect(persist.mock.calls[0][0].rulesets[0].targets.annualMinCpd).toBe(25)
    expect(data.rulesets[0].targets.annualMinCpd).toBe(20)
    await userEvent.click(screen.getByRole('button', { name: 'Add ruleset' }))
    expect(screen.getByText('New ruleset', { selector: 'h3' })).toBeTruthy()
    await userEvent.click(screen.getAllByTitle('Delete ruleset')[1])
    expect(screen.queryByText('New ruleset', { selector: 'h3' })).toBeNull()
  })
})
