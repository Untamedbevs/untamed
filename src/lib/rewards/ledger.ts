import type { SupabaseClient } from '@supabase/supabase-js'

export type LedgerType =
  | 'receipt_approved'
  | 'signup_bonus'
  | 'redemption'
  | 'adjustment'
  | 'ugc_approved'
  | 'online_order'
  | 'referral_signup'
  | 'referral_purchase'
  | 'reversal'
  | 'expiration'
  | 'promotion'

export interface ApplyPointsArgs {
  memberId: string
  /** Positive to credit, negative to debit. */
  points: number
  type: LedgerType
  description: string
  orderId?: string | null
  receiptId?: string | null
  staffId?: string | null
}

export interface ApplyPointsResult {
  transactionId: string
  newBalance: number
}

export class InsufficientPointsError extends Error {
  constructor(message = 'Insufficient points') {
    super(message)
    this.name = 'InsufficientPointsError'
  }
}

/**
 * The one way to change a member's points balance. Calls the
 * `loyalty_apply_points` function (migration 00028), which locks the member
 * row, writes the ledger entry, and updates the balance atomically, so two
 * concurrent credits can never overwrite each other.
 *
 * Eligibility (enrollment, state rules, caps) is checked by the callers via
 * `src/lib/rewards/eligibility.ts` before they get here.
 */
export async function applyPoints(
  admin: SupabaseClient,
  args: ApplyPointsArgs
): Promise<ApplyPointsResult> {
  if (!Number.isInteger(args.points) || args.points === 0) {
    throw new Error(`applyPoints: points must be a non-zero integer (got ${args.points})`)
  }

  const { data, error } = await admin.rpc('loyalty_apply_points', {
    p_member_id: args.memberId,
    p_points: args.points,
    p_type: args.type,
    p_description: args.description,
    p_order_id: args.orderId ?? null,
    p_receipt_id: args.receiptId ?? null,
    p_staff_id: args.staffId ?? null,
  })

  if (error) {
    if (error.code === '23514') throw new InsufficientPointsError(error.message)
    throw new Error(`applyPoints failed: ${error.message}`)
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { transaction_id: string; new_balance: number }
    | undefined
  if (!row) throw new Error('applyPoints: no result returned')

  return { transactionId: row.transaction_id, newBalance: row.new_balance }
}

export interface RedeemRewardArgs {
  memberId: string
  rewardSlug: string
  rewardLabel: string
  pointsCost: number
  retailValueCents?: number
  shipState?: string | null
}

export interface RedeemRewardResult {
  /** The saved loyalty_redemptions row. */
  redemption: { id: string; redeem_transaction_id: string } & Record<string, unknown>
  newBalance: number
}

/**
 * Redeem a reward: debit its cost and record the redemption in one locked,
 * all-or-nothing call (`loyalty_redeem_reward`, migration 00032), so a stop
 * partway can't leave a debit without its redemption or the other way round.
 * Returns 'insufficient' when the balance is too low; nothing is written then.
 */
export async function redeemReward(
  admin: SupabaseClient,
  args: RedeemRewardArgs
): Promise<RedeemRewardResult | 'insufficient'> {
  const { data, error } = await admin.rpc('loyalty_redeem_reward', {
    p_member_id: args.memberId,
    p_reward_slug: args.rewardSlug,
    p_reward_label: args.rewardLabel,
    p_points_cost: args.pointsCost,
    p_retail_value_cents: args.retailValueCents ?? 0,
    p_ship_state: args.shipState ?? null,
  })

  if (error) {
    if (error.code === '23514') return 'insufficient'
    throw new Error(`redeemReward failed: ${error.message}`)
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { redemption: RedeemRewardResult['redemption']; new_balance: number }
    | undefined
  if (!row) throw new Error('redeemReward: no result returned')

  return { redemption: row.redemption, newBalance: row.new_balance }
}
