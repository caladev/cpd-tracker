export function uniqueProviders(entries = []) {
  const seen = new Set()
  for (const e of entries || []) {
    const p = typeof e?.provider === 'string' ? e.provider.trim() : ''
    if (p) seen.add(p)
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}
