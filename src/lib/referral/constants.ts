export const RESERVED_CODES = new Set([
  'admin', 'api', 'referral', 'refer', 'ref', 'app', 'dashboard',
  'login', 'signup', 'auth', 'checkout', 'rewards', 'drinks',
  'distribute', 'distributor', 'profile', 'settings', 'account',
  'help', 'support', 'blog', 'about', 'contact', 'terms', 'privacy',
  'untamed', 'black-panther', 'cheetah', 'cougar', 'lioness',
])

export const CODE_REGEX = /^[a-z0-9][a-z0-9-]{0,18}[a-z0-9]$/

export const CODE_MIN_LENGTH = 2
export const CODE_MAX_LENGTH = 20

export const CUSTOM_MESSAGE_MAX_LENGTH = 2000

export const WARM_INTRO_DAILY_LIMIT = 10

export const REF_COOKIE_NAME = 'ut_ref'
export const REF_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  bar_restaurant: 'Bar / Restaurant',
  liquor_store: 'Liquor Store',
  distributor: 'Distributor',
  event_venue: 'Event Venue',
  other: 'Other',
}

export const VOLUME_INTEREST_LABELS: Record<string, string> = {
  small: 'Small (1-10 cases/month)',
  medium: 'Medium (10-50 cases/month)',
  large: 'Large (50+ cases/month)',
}

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  negotiating: 'Negotiating',
  converted: 'Converted',
  declined: 'Declined',
}

export const LEAD_SLA_HOURS = 48

export const LEAD_ACTIVITY_LABELS: Record<string, string> = {
  created: 'Created',
  status_change: 'Status',
  note: 'Note',
  called: 'Called',
  emailed: 'Emailed',
  meeting: 'Meeting',
  sample_sent: 'Sample sent',
  next_action: 'Next action',
}
