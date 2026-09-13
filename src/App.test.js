// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import App from './App.jsx'
import { createDefaultData } from './lib/defaults.js'
import { getData, getInfo, saveData, deleteFile } from './api.js'

vi.mock('./api.js', () => ({
  getData: vi.fn(), getInfo: vi.fn(), saveData: vi.fn(), deleteFile: vi.fn(),
  assetUrl: (value) => `/api/file?path=${encodeURIComponent(value)}`,
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-13T00:00:00Z'))
  getData.mockResolvedValue(createDefaultData())
  getInfo.mockResolvedValue({ entryCount: 0, persisted: true })
  saveData.mockImplementation(async (data) => data)
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('main navigation', () => {
  it('shows startup errors instead of presenting an empty tracker', async () => {
    getData.mockRejectedValueOnce(new Error('Storage unavailable'))
    render(React.createElement(App))
    expect(await screen.findByText('Storage unavailable')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(saveData).not.toHaveBeenCalled()
  })

  it('creates an entry, edits it, promotes a draft and deletes it through the app', async () => {
    const user = userEvent.setup()
    render(React.createElement(App))
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    await user.click(screen.getAllByRole('button', { name: 'New entry', exact: true })[0])
    fireEvent.change(screen.getByLabelText(/^Activity/), { target: { value: 'New activity' } })
    fireEvent.change(screen.getByLabelText(/^Hours/), { target: { value: '2' } })
    await user.click(screen.getByRole('button', { name: 'Draft', exact: true }))
    await user.click(within(screen.getByLabelText(/^Activity/).closest('form')).getByRole('button', { name: 'Add entry', exact: true }))
    await waitFor(() => expect(screen.queryByText('New CPD entry')).toBeNull())
    expect(saveData.mock.calls[0][0].entries[0]).toMatchObject({ title: 'New activity', hours: 2, status: 'Draft' })
    await user.click(within(nav).getByRole('button', { name: 'CPD Hours' }))
    await user.click(screen.getByTitle('Edit'))
    fireEvent.change(screen.getByLabelText(/^Activity/), { target: { value: 'Edited activity' } })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.queryByText('Edit CPD entry')).toBeNull())
    expect(saveData.mock.calls[1][0].entries[0].title).toBe('Edited activity')
    await user.click(screen.getByTitle('Mark as Actual'))
    expect(saveData.mock.calls[2][0].entries[0].status).toBe('Actual')
    await user.click(screen.getByTitle('Delete'))
    expect(saveData).toHaveBeenCalledTimes(3)
    await user.click(screen.getByTitle('Confirm delete'))
    expect(saveData.mock.calls[3][0].entries).toEqual([])
    expect(await screen.findByText('No entries match')).toBeTruthy()
  })

  it('cleans up file evidence when deleting an entry, even if one file is already missing', async () => {
    const data = createDefaultData()
    data.entries = [{ id: 'one', title: 'Course', hours: 1, status: 'Actual', trienniumId: data.trienniums[0].id,
      evidence: [{ kind: 'file', value: 'evidence/a.pdf' }, { kind: 'url', value: 'https://example.org' }] }]
    getData.mockResolvedValueOnce(data)
    deleteFile.mockRejectedValueOnce(new Error('Not found'))
    render(React.createElement(App))
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    await userEvent.click(within(nav).getByRole('button', { name: 'CPD Hours' }))
    await userEvent.click(screen.getByTitle('Delete'))
    await userEvent.click(screen.getByTitle('Confirm delete'))
    expect(deleteFile).toHaveBeenCalledWith('evidence/a.pdf')
    expect(deleteFile).toHaveBeenCalledTimes(1)
    expect(saveData.mock.calls[0][0].entries).toEqual([])
  })
  it('exposes every page as a named, non-submit button with one current page', async () => {
    render(React.createElement(App))
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    const buttons = within(nav).getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Dashboard', 'CPD Hours', 'Rules', 'Exemptions', 'Export', 'Settings',
    ])
    expect(buttons.every((button) => button.type === 'button')).toBe(true)
    expect(buttons.filter((button) => button.getAttribute('aria-current') === 'page')).toEqual([buttons[0]])
  })

  it('opens every page and moves the active indicator without writing data', async () => {
    const user = userEvent.setup()
    render(React.createElement(App))
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    for (const [page, content] of [
      ['CPD Hours', 'No entries match'],
      ['Rules', 'CPD rules per period'],
      ['Exemptions', 'Pro-rata exemptions'],
      ['Export', 'Export your CPD records'],
      ['Settings', 'Storage'],
      ['Dashboard', 'Recent activity'],
    ]) {
      const button = within(nav).getByRole('button', { name: page, exact: true })
      await user.click(button)
      expect(screen.getByRole('heading', { name: page, level: 1 })).toBeTruthy()
      expect(screen.getByRole('heading', { name: content, exact: true })).toBeTruthy()
      expect(within(nav).getAllByRole('button').filter((item) => item.getAttribute('aria-current') === 'page')).toEqual([button])
      expect(button.classList.contains('nav-item--active')).toBe(true)
    }
    expect(saveData).not.toHaveBeenCalled()
    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('supports keyboard navigation and activation', async () => {
    const user = userEvent.setup()
    render(React.createElement(App))
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    await user.tab()
    expect(document.activeElement).toBe(within(nav).getByRole('button', { name: 'Dashboard' }))
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { name: 'CPD Hours', level: 1 })).toBeTruthy()
  })

  it('keeps the sidebar menu displayed at the mobile breakpoint with touch-sized buttons', () => {
    // JSDOM does not lay out media queries; inspect the parsed stylesheet to
    // catch the original display:none regression without claiming visual QA.
    const style = document.createElement('style')
    style.textContent = readFileSync(path.resolve('src/styles.css'), 'utf8')
    document.head.append(style)
    try {
      const rules = [...style.sheet.cssRules]
      const mobile = rules.filter((rule) => /860px/.test(rule.media?.mediaText || rule.conditionText || ''))
        .flatMap((rule) => [...rule.cssRules])
      expect(mobile.length).toBeGreaterThan(0)
      const applicable = [...rules, ...mobile].filter((rule) => rule.selectorText)
      const sidebarRules = applicable.filter((rule) => rule.selectorText.split(',').map((s) => s.trim()).includes('.sidebar'))
      const displays = sidebarRules.map((rule) => rule.style.getPropertyValue('display')).filter(Boolean)
      expect(displays.at(-1)).toBe('flex')
      expect(mobile.find((rule) => rule.selectorText === '.nav').style.getPropertyValue('display')).toBe('grid')
      expect(parseFloat(mobile.find((rule) => rule.selectorText === '.nav-item').style.getPropertyValue('min-height'))).toBeGreaterThanOrEqual(44)
    } finally {
      style.remove()
    }
  })
})
