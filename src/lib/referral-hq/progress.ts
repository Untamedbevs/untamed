import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ENGAGEMENT_TYPES,
  RANKS,
  TROPHIES,
  isEngagementEntry,
  trophyProgress,
  type Progress,
} from './program'

/**
 * Referral HQ on real data, for the member portal. Server only: it reads the
 * member's referred friends with the admin client, and hands the page counts
 * by state and friends' first names, never emails, last names, or which
 * friend lives where.
 */

export interface WeeklyFriends {
  /** Monday of the week (UTC), YYYY-MM-DD. */
  weekOf: string
  /** Friends who joined through the link and completed 21+ enrollment that week. */
  friends: number
}

export interface FeedEntry {
  id: string
  date: string
  kind: 'enrolled' | 'friend' | 'content' | 'hunt' | 'bonus' | 'rank' | 'badge' | 'redeem'
  label: string
  detail: string
  /** Points earned (+) or spent (−); null for entries that carry no points. */
  points: number | null
  status?: 'pending' | 'fulfilled' | 'cancelled'
}

export interface MemberHq {
  /** Lifetime engagement points: what rank is based on. Redeeming never lowers it. */
  engagementPoints: number
  progress: Progress
  /** When each rank and badge was reached (ISO), by id. */
  earnedDates: Record<string, string>
  /** Friends who joined through the member's link and completed 21+ enrollment. */
  friendsJoined: number
  /** Those friends, counted by state of residence. */
  friendsByState: Record<string, number>
  weekly: WeeklyFriends[]
  /** Newest first: engagement, friends, milestones and redemptions. Never purchases. */
  feed: FeedEntry[]
  /** Retail value of this calendar year's redemptions (cancelled excluded), in cents. */
  rewardValueThisYearCents: number
}

interface LedgerRow {
  id: string
  points: number
  type: string
  description: string | null
  created_at: string
}

interface FriendRow {
  first_name: string | null
  residence_state: string | null
  program_enrolled_at: string
  referral_credited_at: string | null
}

interface PostRow {
  status: 'approved' | 'featured'
  reviewed_at: string | null
  created_at: string
}

interface RedemptionRow {
  id: string
  reward_label: string
  points_cost: number
  status: 'pending' | 'fulfilled' | 'cancelled'
  retail_value_cents: number | null
  created_at: string
}

const WEEKS = 8
const FEED_LENGTH = 8
const DAY_MS = 24 * 60 * 60 * 1000
/** A friend's referral credit is written moments after their credit claim. */
const CREDIT_MATCH_MS = 5 * 60 * 1000

/** First word only, so a full name typed into "first name" never shows. */
function firstNameOnly(name: string | null) {
  return name?.trim().split(/\s+/)[0] || null
}

function weekStart(d: Date) {
  const sinceMonday = (d.getUTCDay() + 6) % 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceMonday))
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

export async function loadMemberHq(
  admin: SupabaseClient,
  member: { id: string; program_enrolled_at: string | null },
  participantId: string | null,
  now: Date = new Date()
): Promise<MemberHq> {
  const [ledgerRes, friendsRes, postsRes, redemptionsRes] = await Promise.all([
    admin
      .from('loyalty_transactions')
      .select('id, points, type, description, created_at')
      .eq('member_id', member.id)
      .in('type', ENGAGEMENT_TYPES)
      .order('created_at', { ascending: true }),
    participantId
      ? admin
          .from('loyalty_members')
          .select('first_name, residence_state, program_enrolled_at, referral_credited_at')
          .eq('referred_by_participant_id', participantId)
          .not('program_enrolled_at', 'is', null)
      : Promise.resolve({ data: [] }),
    admin
      .from('ugc_submissions')
      .select('status, reviewed_at, created_at')
      .eq('loyalty_member_id', member.id)
      .in('status', ['approved', 'featured'])
      .gt('points_awarded', 0),
    admin
      .from('loyalty_redemptions')
      .select('id, reward_label, points_cost, status, retail_value_cents, created_at')
      .eq('member_id', member.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const ledger = ((ledgerRes.data || []) as LedgerRow[]).filter(isEngagementEntry)
  const friends = (friendsRes.data || []) as FriendRow[]
  const posts = (postsRes.data || []) as PostRow[]
  const redemptions = (redemptionsRes.data || []) as RedemptionRow[]

  // Rank dates: when the running engagement total first crossed each rank.
  const earnedDates: Record<string, string> = {}
  let running = 0
  for (const entry of ledger) {
    running += entry.points
    for (const rank of RANKS) {
      if (running >= rank.points && !earnedDates[rank.id]) earnedDates[rank.id] = entry.created_at
    }
  }
  const engagementPoints = Math.max(0, running)

  const friendCredits = ledger.filter((e) => e.type === 'referral_signup' && e.points > 0)
  const contentCredits = ledger.filter((e) => e.type === 'ugc_approved' && e.points > 0)
  const postDate = (p: PostRow) => p.reviewed_at || p.created_at
  const sortedPosts = [...posts].sort((a, b) => postDate(a).localeCompare(postDate(b)))
  const featured = sortedPosts.filter((p) => p.status === 'featured')

  const progress: Progress = {
    enrolled: !!member.program_enrolled_at,
    friendsRewarded: friendCredits.length,
    postsApproved: posts.length,
    postsFeatured: featured.length,
  }

  const firstBonus = ledger.find((e) => e.type === 'signup_bonus')
  for (const trophy of TROPHIES) {
    if (trophyProgress(trophy, progress) < trophy.goal) continue
    const date =
      trophy.metric === 'enrolled'
        ? firstBonus?.created_at || member.program_enrolled_at
        : trophy.metric === 'friends'
          ? friendCredits[trophy.goal - 1]?.created_at
          : trophy.metric === 'posts-approved'
            ? contentCredits[0]?.created_at || (sortedPosts[0] && postDate(sortedPosts[0]))
            : featured[0] && postDate(featured[0])
    if (date) earnedDates[trophy.id] = date
  }

  const friendsByState: Record<string, number> = {}
  for (const f of friends) {
    if (f.residence_state) friendsByState[f.residence_state] = (friendsByState[f.residence_state] || 0) + 1
  }

  const thisWeek = weekStart(now)
  const weekly: WeeklyFriends[] = Array.from({ length: WEEKS }, (_, i) => ({
    weekOf: isoDay(new Date(thisWeek.getTime() - (WEEKS - 1 - i) * 7 * DAY_MS)),
    friends: 0,
  }))
  for (const f of friends) {
    const week = weekly.find((w) => w.weekOf === isoDay(weekStart(new Date(f.program_enrolled_at))))
    if (week) week.friends++
  }

  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString()
  const rewardValueThisYearCents = redemptions
    .filter((r) => r.status !== 'cancelled' && r.created_at >= yearStart)
    .reduce((sum, r) => sum + (r.retail_value_cents || 0), 0)

  return {
    engagementPoints,
    progress,
    earnedDates,
    friendsJoined: friends.length,
    friendsByState,
    weekly,
    feed: buildFeed({ ledger, friends, redemptions, earnedDates, engagementPoints, progress }),
    rewardValueThisYearCents,
  }
}

function buildFeed({
  ledger,
  friends,
  redemptions,
  earnedDates,
  engagementPoints,
  progress,
}: {
  ledger: LedgerRow[]
  friends: FriendRow[]
  redemptions: RedemptionRow[]
  earnedDates: Record<string, string>
  engagementPoints: number
  progress: Progress
}): FeedEntry[] {
  // Milestones go first so, on a tie, they sort above the entry that earned them.
  const entries: FeedEntry[] = []

  for (const rank of RANKS) {
    const date = earnedDates[rank.id]
    if (date && engagementPoints >= rank.points) {
      entries.push({ id: `rank-${rank.id}`, date, kind: 'rank', label: `Rank up: ${rank.name}`, detail: rank.tagline, points: null })
    }
  }
  for (const trophy of TROPHIES) {
    const date = earnedDates[trophy.id]
    if (date && trophyProgress(trophy, progress) >= trophy.goal) {
      entries.push({ id: `badge-${trophy.id}`, date, kind: 'badge', label: `Badge: ${trophy.name}`, detail: trophy.description, points: null })
    }
  }

  // Pair each friend with the referral credit written when they enrolled, so
  // the feed can say who joined. Friends past the yearly cap have no credit.
  const unmatched = ledger.filter((e) => e.type === 'referral_signup' && e.points > 0)
  for (const [i, f] of friends.entries()) {
    const claimedAt = new Date(f.referral_credited_at || f.program_enrolled_at).getTime()
    const at = unmatched.findIndex((e) => Math.abs(new Date(e.created_at).getTime() - claimedAt) < CREDIT_MATCH_MS)
    const credit = at >= 0 ? unmatched.splice(at, 1)[0] : null
    const name = firstNameOnly(f.first_name)
    entries.push({
      id: credit ? credit.id : `friend-${i}`,
      date: credit?.created_at || f.program_enrolled_at,
      kind: 'friend',
      label: name ? `${name} joined the pack` : 'A friend joined the pack',
      detail: 'Joined through your link · confirmed 21+',
      points: credit?.points ?? null,
    })
  }

  for (const e of ledger) {
    if (e.type === 'referral_signup' && e.points > 0) {
      if (unmatched.includes(e)) {
        entries.push({ id: e.id, date: e.created_at, kind: 'friend', label: 'A friend joined the pack', detail: 'Joined through your link · confirmed 21+', points: e.points })
      }
    } else if (e.type === 'signup_bonus' && e.points > 0) {
      entries.push({ id: e.id, date: e.created_at, kind: 'enrolled', label: 'Joined Pack Rewards', detail: 'Welcome bonus', points: e.points })
    } else if (e.type === 'ugc_approved' && e.points > 0) {
      const isFeature = /featured/i.test(e.description || '')
      entries.push({
        id: e.id,
        date: e.created_at,
        kind: 'content',
        label: isFeature ? 'Post featured by Untamed' : 'Post approved',
        detail: isFeature ? 'Shared with the whole pack' : 'Thanks for sharing your moment',
        points: e.points,
      })
    } else if (e.type === 'promotion' && e.points > 0) {
      entries.push({
        id: e.id,
        date: e.created_at,
        kind: 'hunt',
        label: 'Hunt complete',
        detail: (e.description || '').replace(/^Hunt approved: /, ''),
        points: e.points,
      })
    } else {
      entries.push({ id: e.id, date: e.created_at, kind: 'bonus', label: e.points > 0 ? 'Points from Untamed' : 'Points adjusted', detail: e.description || '', points: e.points })
    }
  }

  for (const r of redemptions) {
    entries.push({
      id: r.id,
      date: r.created_at,
      kind: 'redeem',
      label: `Redeemed: ${r.reward_label}`,
      detail: r.status === 'cancelled' ? 'Cancelled, points returned' : 'Merch from the rewards catalog',
      points: r.status === 'cancelled' ? null : -r.points_cost,
      status: r.status,
    })
  }

  return entries
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, FEED_LENGTH)
}
