// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
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
  getData.mockResolvedValue(createDefaultData())
  getInfo.mockResolvedValue({ entryCount: 0, persisted: true })
})
afterEach(cleanup)

describe('main navigation', () => {
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
