export function currentExportTriennium(trienniums, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const today = `${values.year}-${values.month}-${values.day}`
  return trienniums.find((t) => t.period?.start <= today && (!t.period.end || today <= t.period.end))?.id || ''
}

export function scopeExport(data, id = currentExportTriennium(data.trienniums)) {
  const triennium = data.trienniums.find((t) => t.id === id)
  if (!triennium) throw new Error('Select a valid triennium to export.')
  return { ...data, trienniums: [triennium], entries: data.entries.filter((entry) => entry.trienniumId === id) }
}
