export const INFLUENCER_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'other'] as const
export type InfluencerPlatform = (typeof INFLUENCER_PLATFORMS)[number]

export const FOLLOWER_TIERS = ['nano', 'micro', 'mid', 'macro'] as const
export type FollowerTier = (typeof FOLLOWER_TIERS)[number]

export const CONTENT_FOCUSES = [
  'nightlife',
  'food',
  'hosting',
  'lifestyle',
  'fashion',
  'music',
  'fitness',
  'other',
] as const
export type ContentFocus = (typeof CONTENT_FOCUSES)[number]

export const COMPENSATION_PREFS = ['open', 'gifted', 'paid', 'affiliate'] as const
export type CompensationPref = (typeof COMPENSATION_PREFS)[number]

export const INFLUENCER_STATUSES = [
  'new',
  'reviewing',
  'outreach',
  'negotiating',
  'active',
  'declined',
] as const
export type InfluencerLeadStatus = (typeof INFLUENCER_STATUSES)[number]

export interface InfluencerLead {
  id: string
  name: string
  email: string
  phone: string | null
  location: string | null
  primary_platform: InfluencerPlatform
  handle: string
  profile_url: string
  other_handles: string | null
  follower_tier: FollowerTier
  content_focus: ContentFocus
  compensation: CompensationPref
  content_link: string | null
  message: string | null
  is_21: boolean
  audience_is_21: boolean
  status: InfluencerLeadStatus
  admin_notes: string | null
  next_action: string | null
  next_action_at: string | null
  first_contacted_at: string | null
  event_id: string | null
  visitor_fingerprint: string | null
  session_id: string | null
  first_utm_source: string | null
  first_utm_medium: string | null
  first_utm_campaign: string | null
  first_utm_content: string | null
  first_utm_term: string | null
  first_gclid: string | null
  first_fbclid: string | null
  first_landing_page: string | null
  first_referrer: string | null
  converting_utm_source: string | null
  converting_utm_medium: string | null
  converting_utm_campaign: string | null
  converting_gclid: string | null
  converting_fbclid: string | null
  converting_landing_page: string | null
  created_at: string
  updated_at: string
}
