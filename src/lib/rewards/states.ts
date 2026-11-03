/** US states plus DC, for the enrollment state picker and state rules. */
export const US_STATES = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['DC', 'District of Columbia'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
] as const

export type UsStateCode = (typeof US_STATES)[number][0]

const STATE_NAMES = new Map<string, string>(US_STATES)

export function isUsStateCode(value: unknown): value is UsStateCode {
  return typeof value === 'string' && STATE_NAMES.has(value)
}

export function stateName(code: string): string {
  return STATE_NAMES.get(code) ?? code
}

/** Normalizes "fl", " Florida ", or "FL" to "FL"; null when unrecognized. */
export function normalizeStateCode(value: unknown): UsStateCode | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  const upper = trimmed.toUpperCase()
  if (isUsStateCode(upper)) return upper
  for (const [code, name] of US_STATES) {
    if (name.toLowerCase() === trimmed.toLowerCase()) return code
  }
  return null
}
