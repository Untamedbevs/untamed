import { REWARDS } from '@/lib/loyalty/constants'
import type { FeedEntry, MemberHq } from './progress'
import { ENGAGEMENT, RANKS, TROPHIES, trophyProgress, type Progress } from './program'

/**
 * Demo members for the staff preview at /referral-hq. Each stage is a timeline
 * of made-up events run through the live program's rules (points, ranks,
 * badges), so the rank card, trail, badges, feed and charts agree with each
 * other the same way they will on real data in the portal.
 */

export const DEMO_STAGES = [
  { id: 'not-enrolled', label: 'Not enrolled yet' },
  { id: 'new', label: 'New member' },
  { id: 'regular', label: 'Regular' },
  { id: 'top', label: 'Top referrer' },
] as const

export type DemoStageId = (typeof DEMO_STAGES)[number]['id']

export interface DemoMember {
  enrolled: boolean
  homeState: string
  /** Spendable points: engagement plus purchase points, minus redemptions. */
  balance: number
  hq: MemberHq
  /** Friends credited this calendar year (the 25-a-year cap). */
  friendsThisYear: number
}

type DemoEvent =
  | { daysAgo: number; kind: 'enrolled' }
  | { daysAgo: number; kind: 'friend'; name: string; state: string }
  | { daysAgo: number; kind: 'post' | 'featured' }
  | { daysAgo: number; kind: 'bonus'; points: number; note: string }
  | { daysAgo: number; kind: 'purchase'; points: number }
  | { daysAgo: number; kind: 'redeem'; rewardId: (typeof REWARDS)[number]['id'] }

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKS = 8
const FEED_LENGTH = 8

const NAMES = ['Maya', 'Jordan', 'Chris', 'Tasha', 'Luis', 'Priya', 'Sam', 'Dana', 'Marcus', 'Elle', 'Nico', 'Rae']
const STATES = ['FL', 'FL', 'GA', 'TX', 'NC', 'FL', 'SC', 'TN', 'NY', 'CA', 'AL', 'VA', 'CO', 'OH', 'AZ', 'IL']

function friends(count: number, firstDaysAgo: number, lastDaysAgo: number, offset = 0): DemoEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    daysAgo: Math.round(firstDaysAgo - ((firstDaysAgo - lastDaysAgo) * i) / Math.max(1, count - 1)),
    kind: 'friend' as const,
    name: NAMES[(i + offset) % NAMES.length],
    state: STATES[(i + offset) % STATES.length],
  }))
}

const TIMELINES: Record<DemoStageId, DemoEvent[]> = {
  'not-enrolled': [],
  new: [{ daysAgo: 3, kind: 'enrolled' }, ...friends(1, 1, 1)],
  regular: [
    { daysAgo: 70, kind: 'enrolled' },
    ...friends(8, 62, 4),
    { daysAgo: 55, kind: 'post' },
    { daysAgo: 33, kind: 'featured' },
    { daysAgo: 12, kind: 'post' },
    { daysAgo: 40, kind: 'purchase', points: 2_400 },
    { daysAgo: 20, kind: 'redeem', rewardId: 'coasters' },
  ],
  top: [
    { daysAgo: 420, kind: 'enrolled' },
    ...friends(22, 410, 320, 3),
    ...friends(20, 290, 2, 7),
    ...Array.from({ length: 8 }, (_, i) => ({ daysAgo: 400 - i * 48, kind: 'post' as const })),
    ...Array.from({ length: 6 }, (_, i) => ({ daysAgo: 380 - i * 60, kind: 'featured' as const })),
    { daysAgo: 150, kind: 'bonus', points: 5_000, note: 'Founding-member thank-you' },
    { daysAgo: 90, kind: 'redeem', rewardId: 'apparel' },
    { daysAgo: 25, kind: 'redeem', rewardId: 'koozie' },
  ],
}

/** Monday (UTC) of the week containing `d`, as YYYY-MM-DD. */
function weekOf(d: Date) {
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

export function demoMember(stage: DemoStageId, now = new Date()): DemoMember {
  const at = (daysAgo: number, bumpSeconds = 0) =>
    new Date(now.getTime() - daysAgo * DAY_MS + bumpSeconds * 1000).toISOString()
  const events = [...TIMELINES[stage]].sort((a, b) => b.daysAgo - a.daysAgo)

  const progress: Progress = { enrolled: false, friendsRewarded: 0, postsApproved: 0, postsFeatured: 0 }
  const earnedDates: Record<string, string> = {}
  const friendsByState: Record<string, number> = {}
  const feed: FeedEntry[] = []
  const friendDates: Date[] = []
  let engagement = 0
  let balance = 0
  let rewardValueThisYearCents = 0

  const earn = (points: number) => {
    engagement += points
    balance += points
  }

  events.forEach((e, n) => {
    const date = at(e.daysAgo)
    const id = `${e.kind}-${n}`
    switch (e.kind) {
      case 'enrolled':
        progress.enrolled = true
        earn(ENGAGEMENT.enrolled)
        feed.push({ id, date, kind: 'enrolled', label: 'Joined Pack Rewards', detail: 'Welcome bonus', points: ENGAGEMENT.enrolled })
        break
      case 'friend':
        progress.friendsRewarded++
        friendsByState[e.state] = (friendsByState[e.state] || 0) + 1
        friendDates.push(new Date(date))
        earn(ENGAGEMENT.friendJoined)
        feed.push({ id, date, kind: 'friend', label: `${e.name} joined the pack`, detail: 'Joined through your link · confirmed 21+', points: ENGAGEMENT.friendJoined })
        break
      case 'post':
      case 'featured': {
        const featured = e.kind === 'featured'
        const points = featured ? ENGAGEMENT.postFeatured : ENGAGEMENT.postApproved
        progress.postsApproved++
        if (featured) progress.postsFeatured++
        earn(points)
        feed.push({
          id,
          date,
          kind: 'content',
          label: featured ? 'Post featured by Untamed' : 'Post approved',
          detail: featured ? 'Shared with the whole pack' : 'Thanks for sharing your moment',
          points,
        })
        break
      }
      case 'bonus':
        earn(e.points)
        feed.push({ id, date, kind: 'bonus', label: 'Points from Untamed', detail: e.note, points: e.points })
        break
      case 'purchase':
        // Purchase points spend like any other but never count toward rank or show in the feed.
        balance += e.points
        break
      case 'redeem': {
        const reward = REWARDS.find((r) => r.id === e.rewardId)!
        balance -= reward.pointsCost
        if (new Date(date).getUTCFullYear() === now.getUTCFullYear()) {
          rewardValueThisYearCents += reward.retailValueCents
        }
        feed.push({
          id,
          date,
          kind: 'redeem',
          label: `Redeemed: ${reward.name}`,
          detail: 'Merch from the rewards catalog',
          points: -reward.pointsCost,
          status: 'fulfilled',
        })
        break
      }
    }

    // Milestones reached by this event, dated a moment after it so they sort above it.
    for (const rank of RANKS) {
      if (engagement >= rank.points && !earnedDates[rank.id]) {
        earnedDates[rank.id] = at(e.daysAgo, 1)
        feed.push({ id: `rank-${rank.id}`, date: earnedDates[rank.id], kind: 'rank', label: `Rank up: ${rank.name}`, detail: rank.tagline, points: null })
      }
    }
    for (const trophy of TROPHIES) {
      if (trophyProgress(trophy, progress) >= trophy.goal && !earnedDates[trophy.id]) {
        earnedDates[trophy.id] = at(e.daysAgo, 2)
        feed.push({ id: `badge-${trophy.id}`, date: earnedDates[trophy.id], kind: 'badge', label: `Badge: ${trophy.name}`, detail: trophy.description, points: null })
      }
    }
  })

  const weeks = Array.from({ length: WEEKS }, (_, i) =>
    weekOf(new Date(now.getTime() - (WEEKS - 1 - i) * 7 * DAY_MS))
  )
  const weekly = weeks.map((w) => ({ weekOf: w, friends: friendDates.filter((d) => weekOf(d) === w).length }))

  return {
    enrolled: progress.enrolled,
    homeState: 'FL',
    balance,
    friendsThisYear: friendDates.filter((d) => d.getUTCFullYear() === now.getUTCFullYear()).length,
    hq: {
      engagementPoints: engagement,
      progress,
      earnedDates,
      friendsJoined: progress.friendsRewarded,
      friendsByState,
      weekly,
      feed: feed.sort((a, b) => b.date.localeCompare(a.date)).slice(0, FEED_LENGTH),
      rewardValueThisYearCents,
    },
  }
}
