/**
 * Referral HQ: the ranks, badges and art behind the member portal
 * (/portal, /portal/referrals, /portal/rewards).
 *
 * Untamed sells spirits, so this follows the live program's guardrails
 * (src/lib/rewards/program.ts): ranks climb on engagement points only, earned
 * by enrolling, by friends who complete 21+ enrollment, by approved or
 * featured content, and by points staff add by hand. Purchase points spend
 * the same way but never count toward rank. Ranks and badges are recognition
 * only: they award no points and no merchandise. Merch comes from the rewards
 * catalog (src/lib/loyalty/constants.ts), never alcohol.
 *
 * Point amounts and caps are imported from the live program; the UI reads
 * everything else from this file.
 */

import { POINTS, type Reward } from '@/lib/loyalty/constants'
import { CAPS } from '@/lib/rewards/program'
import type { IneligibleReason } from '@/lib/rewards/eligibility'

export { PROGRAM_NAME, PROGRAM_RULES_PATH } from '@/lib/rewards/program'

export const ASSET_BASE = '/images/referral-hq'

/** Friends a referrer can be rewarded for per calendar year (Program Rules). */
export const REFERRALS_PER_YEAR = CAPS.REFERRAL_CREDITS_PER_YEAR

/** Retail value of rewards a member can receive per calendar year, in cents. */
export const ANNUAL_REWARD_CAP_CENTS = CAPS.ANNUAL_REWARD_VALUE_CENTS

export const ENGAGEMENT = {
  enrolled: POINTS.SIGNUP_BONUS,
  /** When a friend joins through the member's link and completes 21+ enrollment. */
  friendJoined: POINTS.REFERRAL_SIGNUP,
  postApproved: POINTS.PER_UGC_APPROVED,
  /** Total for a featured post, including its approval points. */
  postFeatured: POINTS.PER_UGC_FEATURED,
} as const

/**
 * Ledger types that count toward rank and badges. Adjustments count only when
 * positive. Never online_order, receipt_approved or referral_purchase.
 */
export const ENGAGEMENT_TYPES = ['signup_bonus', 'referral_signup', 'ugc_approved', 'adjustment'] as const

export function isEngagementEntry(entry: { type: string; points: number }) {
  if (entry.type === 'adjustment') return entry.points > 0
  return (ENGAGEMENT_TYPES as readonly string[]).includes(entry.type)
}

export interface Rank {
  id: string
  name: string
  /** Lifetime engagement points to reach this rank. */
  points: number
  tagline: string
  /** Marker position on the trail map, as % of the map's width/height. */
  map: { x: number; y: number }
}

export const RANKS: Rank[] = [
  { id: 'cub', name: 'Cub', points: ENGAGEMENT.enrolled, tagline: 'First scratch on the map.', map: { x: 9.6, y: 83.5 } },
  { id: 'prowler', name: 'Prowler', points: 5_000, tagline: 'They can feel you watching.', map: { x: 26.4, y: 66.4 } },
  { id: 'stalker', name: 'Stalker', points: 10_000, tagline: 'Locked on. Closing in.', map: { x: 36.1, y: 51.3 } },
  { id: 'hunter', name: 'Hunter', points: 25_000, tagline: 'You eat what you hunt.', map: { x: 62.2, y: 47.6 } },
  { id: 'alpha', name: 'Alpha', points: 50_000, tagline: 'The pack moves when you move.', map: { x: 70.3, y: 37.1 } },
  { id: 'apex', name: 'Apex', points: 100_000, tagline: 'Nothing hunts you.', map: { x: 82, y: 27.3 } },
  { id: 'legend', name: 'Legend', points: 200_000, tagline: 'They tell stories about you.', map: { x: 91.1, y: 15.1 } },
]

export function rankArt(rankId: string) {
  return `${ASSET_BASE}/ranks/${rankId}.webp`
}

/**
 * Art for each catalog reward; null shows a branded icon tile. The coaster
 * set uses the round claw medallion (it was drawn as rank art).
 */
export const CATALOG_ART: Record<Reward['id'], string | null> = {
  coasters: `${ASSET_BASE}/ranks/wild-credit.webp`,
  koozie: null,
  apparel: `${ASSET_BASE}/rewards/hat.webp`,
}

export const CASH_BACK_ART = `${ASSET_BASE}/rewards/coins.webp`

/** Trophy art in public/images/referral-hq/trophies/. */
type TrophyArtId = 'cheetah-sprint' | 'cougar-crew' | 'hot-streak' | 'lioness-pride' | 'pack-builder' | 'panther-pack'

export type TrophyMetric = 'enrolled' | 'friends' | 'posts-approved' | 'posts-featured'

/**
 * Badges for non-consumption actions only. Recognition, not value: they award
 * no points and no merchandise, so they add nothing to the annual reward cap.
 */
export interface Trophy {
  id: string
  name: string
  description: string
  goal: number
  metric: TrophyMetric
  art: TrophyArtId
}

export const TROPHIES: Trophy[] = [
  {
    id: 'into-the-wild',
    name: 'Into the Wild',
    description: 'Join Pack Rewards and confirm you’re 21+',
    goal: 1,
    metric: 'enrolled',
    art: 'cheetah-sprint',
  },
  {
    id: 'first-friend',
    name: 'First Friend',
    description: 'A friend joins through your link and confirms 21+',
    goal: 1,
    metric: 'friends',
    art: 'cougar-crew',
  },
  {
    id: 'pack-builder',
    name: 'Pack Builder',
    description: '5 friends join and confirm 21+',
    goal: 5,
    metric: 'friends',
    art: 'pack-builder',
  },
  {
    id: 'pride-leader',
    name: 'Pride Leader',
    description: '10 friends join and confirm 21+',
    goal: 10,
    metric: 'friends',
    art: 'lioness-pride',
  },
  {
    id: 'storyteller',
    name: 'Storyteller',
    description: 'Your first photo or video is approved',
    goal: 1,
    metric: 'posts-approved',
    art: 'panther-pack',
  },
  {
    id: 'spotlight',
    name: 'Spotlight',
    description: 'Untamed features one of your posts',
    goal: 1,
    metric: 'posts-featured',
    art: 'hot-streak',
  },
]

export function trophyArt(trophy: Trophy) {
  return `${ASSET_BASE}/trophies/${trophy.art}.webp`
}

/** Engagement counts behind the badges. Nothing here measures what anyone buys or drinks. */
export interface Progress {
  enrolled: boolean
  /** Friends the member earned referral points for, lifetime. */
  friendsRewarded: number
  /** Approved posts that earned points, featured ones included. */
  postsApproved: number
  postsFeatured: number
}

export function trophyProgress(trophy: Trophy, p: Progress) {
  switch (trophy.metric) {
    case 'enrolled':
      return p.enrolled ? 1 : 0
    case 'friends':
      return p.friendsRewarded
    case 'posts-approved':
      return p.postsApproved
    case 'posts-featured':
      return p.postsFeatured
  }
}

/** Highest rank reached for a lifetime engagement-point total, or null below Cub. */
export function rankFor(points: number): Rank | null {
  let current: Rank | null = null
  for (const rank of RANKS) {
    if (points >= rank.points) current = rank
  }
  return current
}

export function nextRank(points: number): Rank | null {
  return RANKS.find((r) => points < r.points) ?? null
}

export function formatPoints(n: number) {
  return n.toLocaleString('en-US')
}

/** Short form for tight labels: 1K, 25K, 200K. */
export function compactPoints(n: number) {
  return n >= 1_000 ? `${Number((n / 1_000).toFixed(1))}K` : String(n)
}

/** Approximate retail value for labels, e.g. "$12" or "$12.50". */
export function formatRetailValue(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`
}

/** Short date for labels, e.g. "Oct 9", in Untamed's time zone so the server and browser agree. */
export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

/** Members who can fix these themselves on the enrollment form see a locked preview of HQ. */
export const PREVIEW_REASONS: IneligibleReason[] = ['not_enrolled', 'rules_updated', 'enrollment_expired']
