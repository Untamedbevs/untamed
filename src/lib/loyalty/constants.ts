// Community-first program: points are a quiet perk, never the headline.
// One rule under the hood: 100 points per $1 spent. Everything else is a
// flat bonus credited instantly to the same balance.
export const POINTS_PER_DOLLAR = 100

export const POINTS = {
  SIGNUP_BONUS: 1_000,
  /** Referrer bonus when a referred friend joins the pack. */
  REFERRAL_SIGNUP: 1_000,
  /** Referrer bonus when a referred friend makes their first purchase. */
  REFERRAL_FIRST_PURCHASE: 5_000,
  // In-store receipts credit roughly the dollar value of a 4-pack
  // ($24 x POINTS_PER_DOLLAR). Admins can override per receipt.
  PER_RECEIPT: 2_400,
  // Online orders credit exact dollar value (subtotal cents == points); this
  // per-pack rate only remains for receipt defaults and the staff handbook.
  PER_PACK: 2_400,
  PER_UGC_APPROVED: 2_500,
  /** Total for featured content (feature after approve credits the delta). */
  PER_UGC_FEATURED: 7_500,
} as const

export const REWARDS = [
  {
    id: 'coasters',
    name: 'Untamed Coasters',
    description: 'Set of 4 cork-backed coasters, one per big cat.',
    pointsCost: 5_000,
  },
  {
    id: 'koozie',
    name: 'Untamed Koozie',
    description: 'Neoprene can koozie with the Untamed claw logo.',
    pointsCost: 7_500,
  },
  {
    id: 'apparel',
    name: 'Untamed Apparel',
    description: "Hat or T-shirt in your favorite big cat's colorway.",
    pointsCost: 25_000,
  },
] as const

export type Reward = (typeof REWARDS)[number]
