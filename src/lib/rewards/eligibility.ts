import { isOfLegalAge } from './age'
import { ENROLLMENT_VALID_DAYS, PROGRAM_RULES_VERSION, type EarnMechanic } from './program'
import { engagementAllowed, purchasePointsAllowed } from './state-rules'

/** loyalty_members columns the rules engine needs (migration 00028). */
export const MEMBER_PROGRAM_COLUMNS =
  'birthdate, residence_state, program_enrolled_at, program_terms_version, program_status, is_trade_account'

export interface MemberProgramFields {
  birthdate: string | null
  residence_state: string | null
  program_enrolled_at: string | null
  program_terms_version: string | null
  program_status: string | null
  is_trade_account: boolean | null
}

export type IneligibleReason =
  | 'not_enrolled'
  | 'rules_updated'
  | 'enrollment_expired'
  | 'under_age'
  | 'trade_account'
  | 'suspended'
  | 'state_not_eligible'
  | 'purchase_state_not_eligible'

export type EligibilityResult = { ok: true } | { ok: false; reason: IneligibleReason }

export const INELIGIBLE_MESSAGES: Record<IneligibleReason, string> = {
  not_enrolled: 'Confirm your age and state to start earning.',
  rules_updated: 'The Program Rules changed. Review and accept them to keep earning.',
  enrollment_expired: 'Re-confirm your eligibility (it takes a few seconds each year).',
  under_age: 'Pack Rewards is only open to adults 21 and older.',
  trade_account:
    'Accounts connected to alcohol retailers, bars, restaurants, or distributors cannot earn rewards.',
  suspended: 'This rewards account is on hold. Contact loyalty@untamedbeverages.com.',
  state_not_eligible: 'Pack Rewards is only offered in the states Untamed ships to.',
  purchase_state_not_eligible: 'Purchase points are not available in your state yet.',
}

/** Whether the member's enrollment is complete, on the current rules, and recent. */
export function enrollmentStatus(member: MemberProgramFields, now: Date = new Date()): EligibilityResult {
  if (member.program_status && member.program_status !== 'active') {
    return { ok: false, reason: 'suspended' }
  }
  if (member.is_trade_account) return { ok: false, reason: 'trade_account' }
  if (!member.program_enrolled_at || !member.birthdate || !member.residence_state) {
    return { ok: false, reason: 'not_enrolled' }
  }
  // The Program only runs where Untamed ships; a member whose state drops out
  // (or who moved) can re-confirm with an eligible state.
  if (!engagementAllowed(member.residence_state)) return { ok: false, reason: 'state_not_eligible' }
  if (!isOfLegalAge(member.birthdate, now)) return { ok: false, reason: 'under_age' }
  if (member.program_terms_version !== PROGRAM_RULES_VERSION) {
    return { ok: false, reason: 'rules_updated' }
  }
  const enrolledAt = new Date(member.program_enrolled_at).getTime()
  if (now.getTime() - enrolledAt > ENROLLMENT_VALID_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, reason: 'enrollment_expired' }
  }
  return { ok: true }
}

/**
 * Can this member earn points through `mechanic`? Purchase points also need
 * the purchase to happen in an eligible state (the retailer's or ship-to
 * state); when that state is unknown, the member's residence state is used.
 */
export function canEarn(
  member: MemberProgramFields,
  mechanic: EarnMechanic,
  options: { purchaseState?: string | null; now?: Date } = {}
): EligibilityResult {
  const status = enrollmentStatus(member, options.now)
  if (!status.ok) return status

  if (mechanic === 'purchase') {
    if (!purchasePointsAllowed(member.residence_state)) {
      return { ok: false, reason: 'purchase_state_not_eligible' }
    }
    if (options.purchaseState && !purchasePointsAllowed(options.purchaseState)) {
      return { ok: false, reason: 'purchase_state_not_eligible' }
    }
  }

  return { ok: true }
}

/** Redeeming merchandise follows the engagement rules (no purchase involved). */
export function canRedeem(member: MemberProgramFields, now: Date = new Date()): EligibilityResult {
  return canEarn(member, 'engagement', { now })
}
