import { describe, it, expect } from 'vitest'
import { uniqueProviders } from './entries.js'

describe('uniqueProviders (autocomplete source)', () => {
  it('returns empty for no entries', () => {
    expect(uniqueProviders()).toEqual([])
    expect(uniqueProviders([])).toEqual([])
  })

  it('deduplicates providers across entries', () => {
    const entries = [
      { id: 'a', provider: 'CPA Australia' },
      { id: 'b', provider: 'CA ANZ' },
      { id: 'c', provider: 'CPA Australia' },
    ]
    expect(uniqueProviders(entries)).toEqual(['CA ANZ', 'CPA Australia'])
  })

  it('trims surrounding whitespace', () => {
    const entries = [{ id: 'a', provider: '  ATO  ' }]
    expect(uniqueProviders(entries)).toEqual(['ATO'])
  })

  it('ignores entries without a provider and non-string junk', () => {
    const entries = [
      { id: 'a' },
      { id: 'b', provider: '' },
      { id: 'c', provider: '   ' },
      { id: 'd', provider: 42 },
      { id: 'e', provider: null },
    ]
    expect(uniqueProviders(entries)).toEqual([])
  })

  it('sorts providers case-insensitively and never mutates input', () => {
    const entries = [{ id: 'b', provider: 'zoom' }, { id: 'a', provider: 'ATO' }]
    expect(uniqueProviders(entries)).toEqual(['ATO', 'zoom'])
    expect(entries.map((e) => e.provider)).toEqual(['zoom', 'ATO'])
  })
})