/**
 * Shared filter field definitions for the Untamed email blast system.
 * Used by both the blast UI and the audience query layer.
 */

export type Audience = 'loyalty' | 'referrers' | 'distributors' | 'all'

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
  // Shared
  | 'created_after'
  | 'created_before'

export interface FilterOption {
  value: FilterField
  label: string
  group: 'loyalty' | 'referrer' | 'distributor' | 'ugc' | 'shared'
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
  { value: 'created_after', label: 'Created After', group: 'shared' },
  { value: 'created_before', label: 'Created Before', group: 'shared' },
]

export function getFilterOptions(audience: Audience): FilterOption[] {
  return ALL_FILTER_OPTIONS.filter((o) => {
    if (o.group === 'shared') return true
    if (audience === 'all') return true
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
    default:
      return null
  }
}

export function isDateField(field: FilterField): boolean {
  return field === 'created_after' || field === 'created_before'
}

export function isNumberField(field: FilterField): boolean {
  return (
    field === 'points_min' ||
    field === 'points_max' ||
    field === 'min_consumer_signups' ||
    field === 'min_distributor_leads' ||
    field === 'min_paid_conversions' ||
    field === 'min_ugc_submissions'
  )
}

export function isTextField(field: FilterField): boolean {
  return field === 'first_utm_source' || field === 'first_utm_campaign'
}

export function formatFilterValue(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
