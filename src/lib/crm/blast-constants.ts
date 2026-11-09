/**
 * Shared filter field definitions for the Untamed email blast system.
 * Used by both the blast UI and the audience query layer.
 */

export type Audience =
  | 'subscribers'
  | 'customers'
  | 'loyalty'
  | 'referrers'
  | 'distributors'
  | 'all'

export const AUDIENCE_OPTIONS: { value: Audience; label: string; description: string }[] = [
  { value: 'subscribers', label: 'Everyone on the list', description: 'Every contact subscribed to the chosen list' },
  { value: 'customers', label: 'Past customers', description: 'People who placed an online order' },
  { value: 'loyalty', label: 'Loyalty members', description: 'Loyalty program members' },
  { value: 'referrers', label: 'Referrers', description: 'Active referral program participants' },
  { value: 'distributors', label: 'Wholesale leads', description: 'Distributor and retail inquiries' },
  { value: 'all', label: 'All known contacts', description: 'Customers, loyalty, referrers, and wholesale leads' },
]

export type FilterField =
  // Loyalty
  | 'points_min'
  | 'points_max'
  | 'has_receipts'
  | 'favorite_drink_slug'
  | 'first_utm_source'
  | 'first_utm_campaign'
  // Referrers
  | 'referrer_active'
  | 'min_consumer_signups'
  | 'min_distributor_leads'
  | 'min_paid_conversions'
  | 'tier_name'
  // Distributors
  | 'distributor_status'
  | 'business_type'
  | 'volume_interest'
  | 'has_referrer'
  // UGC (works on both loyalty + distributor audiences)
  | 'ugc_status'
  | 'min_ugc_submissions'
  // Customers
  | 'ordered_after'
  | 'ordered_before'
  | 'min_orders'
  | 'min_total_spent'
  | 'bought_product'
  // Any audience (from the contact record)
  | 'state'
  | 'engaged_within_days'
  | 'not_engaged_days'
  // Shared
  | 'created_after'
  | 'created_before'

export interface FilterOption {
  value: FilterField
  label: string
  group: 'loyalty' | 'referrer' | 'distributor' | 'ugc' | 'customer' | 'contact' | 'shared'
}

export const ALL_FILTER_OPTIONS: FilterOption[] = [
  { value: 'points_min', label: 'Min Points Balance', group: 'loyalty' },
  { value: 'points_max', label: 'Max Points Balance', group: 'loyalty' },
  { value: 'has_receipts', label: 'Has Approved Receipts', group: 'loyalty' },
  { value: 'favorite_drink_slug', label: 'Favorite Drink', group: 'loyalty' },
  { value: 'first_utm_source', label: 'First UTM Source', group: 'loyalty' },
  { value: 'first_utm_campaign', label: 'First UTM Campaign', group: 'loyalty' },
  { value: 'referrer_active', label: 'Active Referrer', group: 'referrer' },
  { value: 'min_consumer_signups', label: 'Min Consumer Signups', group: 'referrer' },
  { value: 'min_distributor_leads', label: 'Min Distributor Leads', group: 'referrer' },
  { value: 'min_paid_conversions', label: 'Min Paid Conversions', group: 'referrer' },
  { value: 'tier_name', label: 'Earned Tier', group: 'referrer' },
  { value: 'distributor_status', label: 'Distributor Lead Status', group: 'distributor' },
  { value: 'business_type', label: 'Business Type', group: 'distributor' },
  { value: 'volume_interest', label: 'Volume Interest', group: 'distributor' },
  { value: 'has_referrer', label: 'Has Referrer', group: 'distributor' },
  { value: 'ugc_status', label: 'UGC Submission Status', group: 'ugc' },
  { value: 'min_ugc_submissions', label: 'Min UGC Submissions', group: 'ugc' },
  { value: 'ordered_after', label: 'Ordered On/After', group: 'customer' },
  { value: 'ordered_before', label: 'Ordered On/Before', group: 'customer' },
  { value: 'min_orders', label: 'Min Orders', group: 'customer' },
  { value: 'min_total_spent', label: 'Min Total Spent ($)', group: 'customer' },
  { value: 'bought_product', label: 'Bought Product (name contains)', group: 'customer' },
  { value: 'state', label: 'State (from orders)', group: 'contact' },
  { value: 'engaged_within_days', label: 'Opened/Clicked Within (days)', group: 'contact' },
  { value: 'not_engaged_days', label: 'No Opens/Clicks For (days)', group: 'contact' },
  { value: 'created_after', label: 'Created After', group: 'shared' },
  { value: 'created_before', label: 'Created Before', group: 'shared' },
]

export function getFilterOptions(audience: Audience): FilterOption[] {
  // "Everyone on the list" can only be narrowed by contact-level filters.
  if (audience === 'subscribers') return ALL_FILTER_OPTIONS.filter((o) => o.group === 'contact')
  return ALL_FILTER_OPTIONS.filter((o) => {
    if (o.group === 'contact') return true
    if (o.group === 'shared') return audience !== 'customers'
    if (audience === 'all') return true
    if (o.group === 'customer') return audience === 'customers'
    if (o.group === 'loyalty') return audience === 'loyalty'
    if (o.group === 'referrer') return audience === 'referrers'
    if (o.group === 'distributor') return audience === 'distributors'
    if (o.group === 'ugc') return audience === 'loyalty' || audience === 'distributors'
    return false
  })
}

// ---------------------------------------------------------------------------
// Enumerated value options
// ---------------------------------------------------------------------------

export const BOOLEAN_VALUES = ['yes', 'no']

export const DRINK_SLUGS = ['black-panther', 'cheetah', 'cougar', 'lioness']

export const DISTRIBUTOR_STATUS_VALUES = [
  'new',
  'contacted',
  'qualified',
  'negotiating',
  'converted',
  'declined',
]

export const BUSINESS_TYPE_VALUES = [
  'bar_restaurant',
  'liquor_store',
  'distributor',
  'event_venue',
  'other',
]

export const VOLUME_INTEREST_VALUES = ['small', 'medium', 'large']

export const TIER_NAMES = [
  'Pack Runner',
  'Territory Scout',
  'Alpha Predator',
  'Pride Leader',
]

export const UGC_STATUS_VALUES = [
  'any',
  'pending',
  'approved',
  'featured',
  'rejected',
  'none',
]

export function getValueOptions(field: FilterField): string[] | null {
  switch (field) {
    case 'has_receipts':
    case 'referrer_active':
    case 'has_referrer':
      return BOOLEAN_VALUES
    case 'favorite_drink_slug':
      return DRINK_SLUGS
    case 'distributor_status':
      return DISTRIBUTOR_STATUS_VALUES
    case 'business_type':
      return BUSINESS_TYPE_VALUES
    case 'volume_interest':
      return VOLUME_INTEREST_VALUES
    case 'tier_name':
      return TIER_NAMES
    case 'ugc_status':
      return UGC_STATUS_VALUES
    case 'state':
      return STATE_CODES
    default:
      return null
  }
}

export function isDateField(field: FilterField): boolean {
  return (
    field === 'created_after' ||
    field === 'created_before' ||
    field === 'ordered_after' ||
    field === 'ordered_before'
  )
}

export function isNumberField(field: FilterField): boolean {
  return (
    field === 'points_min' ||
    field === 'points_max' ||
    field === 'min_consumer_signups' ||
    field === 'min_distributor_leads' ||
    field === 'min_paid_conversions' ||
    field === 'min_ugc_submissions' ||
    field === 'min_orders' ||
    field === 'min_total_spent' ||
    field === 'engaged_within_days' ||
    field === 'not_engaged_days'
  )
}

export function isTextField(field: FilterField): boolean {
  return field === 'first_utm_source' || field === 'first_utm_campaign' || field === 'bought_product'
}

export const STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
]

export function formatFilterValue(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
