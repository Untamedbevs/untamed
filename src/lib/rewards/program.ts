/**
 * Untamed Pack Rewards: program policy.
 *
 * Untamed's products are spirits (15% ABV vodka martinis), so the program is
 * built around federal and state alcohol rules. The research behind every
 * decision here, with citations, is in docs/rewards/legal-research-2026-10-30.md
 * and the plain-language summary is docs/rewards/README.md. A lawyer still
 * needs to sign off; until then the conservative choice is the default.
 *
 * Two layers:
 *   - Engagement (every state): enrollment bonus, approved content, and a
 *     referral reward when a friend completes 21+ enrollment. No purchase.
 *   - Purchase (only states switched on in state-rules.ts): points for
 *     online orders and retail receipts, redeemable for merchandise only.
 *
 * Never offered anywhere, by design (these are the mechanics the research
 * says create the most risk):
 *   - Alcohol as a reward, prize, or redemption, or discounts on alcohol.
 *   - Pay or points per sale, or for a friend's purchase (per-sale commission).
 *   - Any reward for referring bars, restaurants, stores, or distributors
 *     (only licensed distributor salespeople may solicit retailers).
 *   - Anything of value to retailers, distributors, or their staff.
 *   - Invitations sent by Untamed's systems (email or text) to people who have
 *     not verified their age and opted in. Members share their own link.
 *   - Ranks, streaks, or trophies based on how much anyone buys or drinks.
 */

export const PROGRAM_NAME = 'Untamed Pack Rewards'
export const PROGRAM_SPONSOR = 'Untamed Beverages, LLC'
export const PROGRAM_SPONSOR_ADDRESS = 'Parrish, FL 34219'
export const PROGRAM_RULES_PATH = '/rewards/rules'

/**
 * Version of the Program Rules members accept. Changing it asks every member
 * to review and accept the new rules before they earn or redeem again.
 */
export const PROGRAM_RULES_VERSION = '2026-11-07'
export const PROGRAM_RULES_EFFECTIVE = 'November 7, 2026'

/** Members re-confirm their eligibility (21+, not in the alcohol trade) yearly. */
export const ENROLLMENT_VALID_DAYS = 365

export const CAPS = {
  /** Referral rewards credited per referrer per calendar year. */
  REFERRAL_CREDITS_PER_YEAR: 25,
  /** Receipt uploads per member per day (fraud control). */
  RECEIPTS_PER_DAY: 4,
  /**
   * Retail value of rewards a member can redeem per calendar year. Kept far
   * below the 1099 reporting threshold ($2,000 for 2026 payments).
   */
  ANNUAL_REWARD_VALUE_CENTS: 50_000,
  /**
   * Online orders placed this many days before enrollment still earn points
   * once the member enrolls (if their state allows purchase points).
   */
  PURCHASE_LOOKBACK_DAYS: 90,
} as const

/**
 * PREVIEW ONLY. Shown on /portal/rewards as "coming soon"; nothing pays out
 * and no code redeems it. Cash back would be a rebate Untamed pays a member
 * directly, against Untamed they already bought (with proof of purchase),
 * never a discount at checkout. Which states would get it, and when, is
 * `cashBack` in state-rules.ts. Numbers are placeholders until a lawyer and
 * Untamed sign off.
 */
export const CASH_BACK_PREVIEW = {
  /** Points per payout step, and what that step pays: 5,000 points = $5. */
  POINTS_PER_STEP: 5_000,
  CENTS_PER_STEP: 500,
  /** Cash back never exceeds this share of what the member paid. */
  MAX_SHARE_OF_PURCHASE: 0.5,
  PAYOUT_METHODS: ['PayPal', 'Venmo', 'gift card'],
} as const

/** The kinds of earning the rules engine distinguishes. */
export type EarnMechanic = 'engagement' | 'referral_signup' | 'purchase'
