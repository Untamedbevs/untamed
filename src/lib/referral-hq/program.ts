/**
 * Referral HQ — milestone program (DRAFT for client review).
 *
 * Every number here is a proposal to iterate on with Untamed, not a committed
 * offer. The UI reads everything from this file, so tuning a threshold, rate,
 * or reward is a one-line change.
 */

export const ASSET_BASE = '/images/referral-hq'

/** Base reward: Wild Credit earned per 4-pack sold through a referral code. */
export const BASE_CREDIT_PER_PACK = 10

export type RewardArt =
  | 'coins'
  | 'four-pack'
  | 'hat'
  | 'hoodie'
  | 'key'
  | 'vip'
  | 'credit-coin'

export interface Rank {
  id: string
  name: string
  /** Lifetime 4-packs sold through the code to reach this rank. */
  packs: number
  /** Wild Credit per 4-pack once this rank is reached. */
  ratePerPack: number
  /** One-time bonus credit awarded on reaching the rank. */
  bonusCredit: number
  /** Physical / experiential unlocks, shown alongside any bonus credit. */
  unlocks: string[]
  rewardArt: RewardArt
  tagline: string
  /** Marker position on the territory map, as % of the map's width/height. */
  map: { x: number; y: number }
}

export const RANKS: Rank[] = [
  {
    id: 'cub',
    name: 'Cub',
    packs: 1,
    ratePerPack: 10,
    bonusCredit: 0,
    unlocks: ['Untamed sticker pack', 'Your territory map'],
    rewardArt: 'credit-coin',
    tagline: 'First scratch on the map.',
    map: { x: 9.6, y: 83.5 },
  },
  {
    id: 'prowler',
    name: 'Prowler',
    packs: 5,
    ratePerPack: 10,
    bonusCredit: 15,
    unlocks: [],
    rewardArt: 'coins',
    tagline: 'They can feel you watching.',
    map: { x: 26.4, y: 66.4 },
  },
  {
    id: 'stalker',
    name: 'Stalker',
    packs: 10,
    ratePerPack: 10,
    bonusCredit: 0,
    unlocks: ['Free 4-pack, any flavor'],
    rewardArt: 'four-pack',
    tagline: 'Locked on. Closing in.',
    map: { x: 36.1, y: 51.3 },
  },
  {
    id: 'hunter',
    name: 'Hunter',
    packs: 25,
    ratePerPack: 12,
    bonusCredit: 0,
    unlocks: ['Untamed snapback', 'Credit rate up to $12 / pack'],
    rewardArt: 'hat',
    tagline: 'You eat what you hunt.',
    map: { x: 62.2, y: 47.6 },
  },
  {
    id: 'alpha',
    name: 'Alpha',
    packs: 50,
    ratePerPack: 12,
    bonusCredit: 75,
    unlocks: ['Alpha hoodie'],
    rewardArt: 'hoodie',
    tagline: 'The pack moves when you move.',
    map: { x: 70.3, y: 37.1 },
  },
  {
    id: 'apex',
    name: 'Apex',
    packs: 100,
    ratePerPack: 15,
    bonusCredit: 0,
    unlocks: ['Credit rate up to $15 / pack', 'Early access to new flavors'],
    rewardArt: 'key',
    tagline: 'Nothing hunts you.',
    map: { x: 82, y: 27.3 },
  },
  {
    id: 'legend',
    name: 'Legend',
    packs: 250,
    ratePerPack: 15,
    bonusCredit: 250,
    unlocks: ['VIP pass to an Untamed launch event'],
    rewardArt: 'vip',
    tagline: 'They tell stories about you.',
    map: { x: 91.1, y: 15.1 },
  },
]

export function rankArt(rankId: string) {
  return `${ASSET_BASE}/ranks/${rankId}.webp`
}

export function rewardArt(art: RewardArt) {
  return art === 'credit-coin'
    ? `${ASSET_BASE}/ranks/wild-credit.webp`
    : `${ASSET_BASE}/rewards/${art}.webp`
}

export function trophyArt(trophyId: string) {
  return `${ASSET_BASE}/trophies/${trophyId}.webp`
}

export type Flavor = 'black-panther' | 'cheetah' | 'cougar' | 'lioness'

export const FLAVORS: Record<Flavor, { name: string; drink: string; color: string }> = {
  'black-panther': { name: 'Black Panther', drink: 'Espresso Martini', color: '#9B30FF' },
  cheetah: { name: 'Cheetah', drink: 'Lemon Drop Martini', color: '#D4D700' },
  cougar: { name: 'Cougar', drink: 'Classic Dirty Martini', color: '#6B8E23' },
  lioness: { name: 'Lioness', drink: 'Peach & Rosemary Martini', color: '#E87511' },
}

export type TrophyMetric =
  | { kind: 'flavor'; flavor: Flavor }
  | { kind: 'all-flavors' }
  | { kind: 'week-streak' }
  | { kind: 'unique-customers' }
  | { kind: 'business-referrals' }

export interface Trophy {
  id: string
  name: string
  description: string
  goal: number
  metric: TrophyMetric
  bonusCredit: number
}

export const TROPHIES: Trophy[] = [
  {
    id: 'panther-pack',
    name: 'Panther Pack',
    description: 'Sell 10 Black Panther 4-packs',
    goal: 10,
    metric: { kind: 'flavor', flavor: 'black-panther' },
    bonusCredit: 10,
  },
  {
    id: 'cheetah-sprint',
    name: 'Cheetah Sprint',
    description: 'Sell 10 Cheetah 4-packs',
    goal: 10,
    metric: { kind: 'flavor', flavor: 'cheetah' },
    bonusCredit: 10,
  },
  {
    id: 'cougar-crew',
    name: 'Cougar Crew',
    description: 'Sell 10 Cougar 4-packs',
    goal: 10,
    metric: { kind: 'flavor', flavor: 'cougar' },
    bonusCredit: 10,
  },
  {
    id: 'lioness-pride',
    name: 'Lioness Pride',
    description: 'Sell 10 Lioness 4-packs',
    goal: 10,
    metric: { kind: 'flavor', flavor: 'lioness' },
    bonusCredit: 10,
  },
  {
    id: 'full-pride',
    name: 'Full Pride',
    description: 'Move all four flavors through your code',
    goal: 4,
    metric: { kind: 'all-flavors' },
    bonusCredit: 20,
  },
  {
    id: 'hot-streak',
    name: 'Hot Streak',
    description: 'Make a sale 4 weeks in a row',
    goal: 4,
    metric: { kind: 'week-streak' },
    bonusCredit: 20,
  },
  {
    id: 'pack-builder',
    name: 'Pack Builder',
    description: '10 different people buy with your code',
    goal: 10,
    metric: { kind: 'unique-customers' },
    bonusCredit: 25,
  },
  {
    id: 'big-game',
    name: 'Big Game',
    description: 'Refer a bar, restaurant, or store that places a wholesale order',
    goal: 1,
    metric: { kind: 'business-referrals' },
    bonusCredit: 100,
  },
]

export interface Progress {
  packsByFlavor: Record<Flavor, number>
  weekStreak: number
  uniqueCustomers: number
  businessReferrals: number
}

export function totalPacks(p: Progress) {
  return Object.values(p.packsByFlavor).reduce((sum, n) => sum + n, 0)
}

export function trophyProgress(trophy: Trophy, p: Progress) {
  const m = trophy.metric
  switch (m.kind) {
    case 'flavor':
      return p.packsByFlavor[m.flavor]
    case 'all-flavors':
      return Object.values(p.packsByFlavor).filter((n) => n > 0).length
    case 'week-streak':
      return p.weekStreak
    case 'unique-customers':
      return p.uniqueCustomers
    case 'business-referrals':
      return p.businessReferrals
  }
}

/** Highest rank reached for a lifetime pack count, or null before the first sale. */
export function rankFor(packs: number): Rank | null {
  let current: Rank | null = null
  for (const rank of RANKS) {
    if (packs >= rank.packs) current = rank
  }
  return current
}

export function nextRank(packs: number): Rank | null {
  return RANKS.find((r) => packs < r.packs) ?? null
}

export function ratePerPack(packs: number) {
  return rankFor(packs)?.ratePerPack ?? BASE_CREDIT_PER_PACK
}

/**
 * Lifetime Wild Credit for a pack count: each pack pays the rate of the rank
 * held once that pack is counted, plus one-time rank and trophy bonuses.
 */
export function lifetimeCredit(packs: number, earnedTrophyBonus = 0) {
  let perPack = 0
  for (let i = 1; i <= packs; i++) perPack += ratePerPack(i)
  const rankBonus = RANKS.filter((r) => packs >= r.packs).reduce(
    (sum, r) => sum + r.bonusCredit,
    0
  )
  return { perPack, rankBonus, trophyBonus: earnedTrophyBonus, total: perPack + rankBonus + earnedTrophyBonus }
}

export function formatCredit(n: number) {
  return `$${n.toLocaleString('en-US')}`
}
