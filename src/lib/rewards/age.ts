export const MINIMUM_AGE = 21

/**
 * Today's calendar date in Hawaii, the earliest US time zone with residents
 * we serve. Using it means nobody is ever treated as 21 a few hours early,
 * wherever they are.
 */
export function conservativeToday(now: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Pacific/Honolulu',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

/**
 * Validates a YYYY-MM-DD birthdate (a real calendar date, not in the future,
 * not before 1900) and returns it normalized, or null.
 */
export function parseBirthdate(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim())
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  if (year < 1900) return null
  const today = conservativeToday()
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day)
  if (date.getTime() > todayUtc) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

/** Whole years of age on the conservative "today". */
export function ageFromBirthdate(birthdate: string, now: Date = new Date()): number {
  const [year, month, day] = birthdate.split('-').map(Number)
  const today = conservativeToday(now)
  let age = today.year - year
  if (today.month < month || (today.month === month && today.day < day)) age -= 1
  return age
}

export function isOfLegalAge(birthdate: string | null | undefined, now: Date = new Date()): boolean {
  if (!birthdate) return false
  return ageFromBirthdate(birthdate, now) >= MINIMUM_AGE
}
