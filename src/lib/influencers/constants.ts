export {
  COMPENSATION_PREFS,
  CONTENT_FOCUSES,
  FOLLOWER_TIERS,
  INFLUENCER_PLATFORMS,
  INFLUENCER_STATUSES,
} from './types'
export type {
  CompensationPref,
  ContentFocus,
  FollowerTier,
  InfluencerLead,
  InfluencerLeadStatus,
  InfluencerPlatform,
} from './types'

import type {
  CompensationPref,
  ContentFocus,
  FollowerTier,
  InfluencerLeadStatus,
  InfluencerPlatform,
} from './types'

export const CREATOR_PURPLE = '#9B30FF'

export const PLATFORM_LABELS: Record<InfluencerPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  other: 'Other',
}

export const FOLLOWER_TIER_LABELS: Record<FollowerTier, string> = {
  nano: 'Under 10k',
  micro: '10k – 50k',
  mid: '50k – 250k',
  macro: '250k+',
}

export const CONTENT_FOCUS_LABELS: Record<ContentFocus, string> = {
  nightlife: 'Nightlife & cocktails',
  food: 'Food & dining',
  hosting: 'Hosting & entertaining',
  lifestyle: 'Lifestyle',
  fashion: 'Fashion & beauty',
  music: 'Music & culture',
  fitness: 'Fitness & wellness',
  other: 'Other',
}

export const COMPENSATION_LABELS: Record<CompensationPref, string> = {
  open: 'Open — let’s talk',
  gifted: 'Gifted product',
  paid: 'Paid campaign',
  affiliate: 'Affiliate / tracked link',
}

export const INFLUENCER_STATUS_LABELS: Record<InfluencerLeadStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  outreach: 'Outreach',
  negotiating: 'Negotiating',
  active: 'Active',
  declined: 'Declined',
}

export const INFLUENCER_STATUS_COLORS: Record<InfluencerLeadStatus, string> = {
  new: '#3b82f6',
  reviewing: '#FFD700',
  outreach: '#FF8C2A',
  negotiating: '#9B30FF',
  active: '#22c55e',
  declined: '#ef4444',
}

export const INFLUENCER_SLA_HOURS = 72

export function cleanHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/^(instagram|tiktok|youtube)\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    .trim()
}

export function withHttps(raw: string): string {
  const t = raw.trim()
  if (!t) return t
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}
