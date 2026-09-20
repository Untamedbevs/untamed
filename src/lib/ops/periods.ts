const ZONE = 'America/New_York'

function parts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const bag: Record<string, string> = {}
  for (const p of fmt.formatToParts(now)) {
    if (p.type !== 'literal') bag[p.type] = p.value
  }
  return bag
}

export function todayIso(now = new Date()) {
  const { year, month, day } = parts(now)
  return `${year}-${month}-${day}`
}

export function weekStartIso(now = new Date()) {
  const { year, month, day, weekday } = parts(now)
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  date.setUTCDate(date.getUTCDate() - (map[weekday] ?? 0))
  return date.toISOString().slice(0, 10)
}

export function monthStartIso(now = new Date()) {
  const { year, month } = parts(now)
  return `${year}-${month}-01`
}

export function yearStartIso(now = new Date()) {
  return `${parts(now).year}-01-01`
}

export function daysAgoIso(days: number, now = new Date()) {
  const { year, month, day } = parts(now)
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

export function isoRange(fromDay: string, toDay = todayIso()) {
  return { from: `${fromDay}T00:00:00.000-05:00`, to: `${toDay}T23:59:59.999-04:00` }
}
