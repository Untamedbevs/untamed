import type { Flavor, Progress } from './program'

/**
 * Fake referrer used by the Referral HQ mock-up. Nothing here touches
 * Supabase; swap for referral_participants / referral_events data later.
 */

export interface LedgerEntry {
  id: string
  date: string
  kind: 'sale' | 'rank' | 'trophy' | 'redeem'
  label: string
  detail: string
  amount: number
  flavor?: Flavor
}

export interface WeeklyPacks {
  weekOf: string
  packs: number
}

export interface DemoReferrer {
  displayName: string
  handle: string
  code: string
  joinedAt: string
  codeUses: number
  linkClicks: number
  redeemedCredit: number
  progress: Progress
  weekly: WeeklyPacks[]
  ledger: LedgerEntry[]
  earnedDates: Record<string, string>
}

export const DEMO_REFERRER: DemoReferrer = {
  displayName: 'Jess Rivera',
  handle: 'Jess',
  code: 'jesswild',
  joinedAt: '2026-06-02',
  codeUses: 29,
  linkClicks: 412,
  redeemedCredit: 120,
  progress: {
    packsByFlavor: {
      'black-panther': 14,
      cheetah: 6,
      cougar: 10,
      lioness: 7,
    },
    weekStreak: 3,
    uniqueCustomers: 12,
    businessReferrals: 0,
  },
  weekly: [
    { weekOf: '2026-08-31', packs: 2 },
    { weekOf: '2026-09-07', packs: 5 },
    { weekOf: '2026-09-14', packs: 0 },
    { weekOf: '2026-09-21', packs: 4 },
    { weekOf: '2026-09-28', packs: 7 },
    { weekOf: '2026-10-05', packs: 3 },
    { weekOf: '2026-10-12', packs: 6 },
    { weekOf: '2026-10-19', packs: 4 },
  ],
  ledger: [
    { id: 'l1', date: '2026-10-21', kind: 'sale', label: '4-pack sold', detail: 'Black Panther · new customer', amount: 12, flavor: 'black-panther' },
    { id: 'l2', date: '2026-10-20', kind: 'sale', label: '2 × 4-pack sold', detail: 'Lioness · repeat customer', amount: 24, flavor: 'lioness' },
    { id: 'l3', date: '2026-10-19', kind: 'sale', label: '4-pack sold', detail: 'Cougar · new customer', amount: 12, flavor: 'cougar' },
    { id: 'l4', date: '2026-10-16', kind: 'redeem', label: 'Credit redeemed', detail: 'Applied to order #UT-2291', amount: -60 },
    { id: 'l5', date: '2026-10-14', kind: 'trophy', label: 'Trophy: Pack Builder', detail: '10 different buyers', amount: 25 },
    { id: 'l6', date: '2026-10-13', kind: 'sale', label: '3 × 4-pack sold', detail: 'Black Panther · new customer', amount: 36, flavor: 'black-panther' },
    { id: 'l7', date: '2026-10-09', kind: 'rank', label: 'Rank up: Hunter', detail: 'Snapback shipping · rate now $12', amount: 0 },
    { id: 'l8', date: '2026-10-08', kind: 'sale', label: '4-pack sold', detail: 'Cheetah · repeat customer', amount: 10, flavor: 'cheetah' },
  ],
  earnedDates: {
    cub: '2026-06-09',
    prowler: '2026-07-01',
    stalker: '2026-08-12',
    hunter: '2026-10-09',
    'panther-pack': '2026-09-29',
    'cougar-crew': '2026-10-19',
    'full-pride': '2026-07-18',
    'pack-builder': '2026-10-14',
  },
}
