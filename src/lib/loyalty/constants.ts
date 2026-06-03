export const POINTS = {
  SIGNUP_BONUS: 10,
  PER_RECEIPT: 25,
  // Online orders through the AccelPay storefront earn the same per-pack rate
  // as an approved in-store receipt, credited automatically (no upload).
  PER_PACK: 25,
  PER_UGC_APPROVED: 50,
  PER_UGC_FEATURED: 150,
} as const

export const REWARDS = [
  {
    id: 'coasters',
    name: 'Untamed Coasters',
    description: 'Set of 4 cork-backed coasters, one per big cat.',
    pointsCost: 100,
  },
  {
    id: 'koozie',
    name: 'Untamed Koozie',
    description: 'Neoprene can koozie with the Untamed claw logo.',
    pointsCost: 150,
  },
  {
    id: 'apparel',
    name: 'Untamed Apparel',
    description: "Hat or T-shirt in your favorite big cat's colorway.",
    pointsCost: 500,
  },
] as const

export type Reward = (typeof REWARDS)[number]
