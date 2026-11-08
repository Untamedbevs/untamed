import type { SupabaseClient } from '@supabase/supabase-js'
import { POINTS } from '@/lib/loyalty/constants'
import { isOfLegalAge, parseBirthdate } from './age'
import { PROGRAM_RULES_VERSION } from './program'
import { engagementAllowed } from './state-rules'
import { normalizeStateCode } from './states'

export interface EnrollmentAttestations {
  /** "I am 21 or older." */
  ofAge: boolean
  /**
   * "I am not an owner, officer, employee, agent or representative of an
   * alcohol retailer, bar, restaurant, wholesaler or distributor, or an
   * immediate family or household member of one."
   */
  notTrade: boolean
  /** "I have read and agree to the Program Rules." */
  acceptsRules: boolean
  /** "When I share Untamed, I'll say that I earn rewards, and only share with people 21+." */
  disclosesReferrals: boolean
}

export interface EnrollmentRequest {
  memberId: string
  authUserId: string
  birthdate: unknown
  residenceState: unknown
  attestations: Partial<EnrollmentAttestations>
  ipHash: string | null
  userAgent: string | null
}

export type EnrollmentError =
  | 'invalid_birthdate'
  | 'under_age'
  | 'invalid_state'
  | 'state_not_eligible'
  | 'attestations_required'
  | 'trade_account'
  | 'account_closed'
  | 'member_not_found'

export type EnrollmentResult =
  | {
      ok: true
      bonusGranted: number
      orderPointsCredited: number
      referrerCredited: boolean
    }
  | { ok: false; error: EnrollmentError }

/**
 * Enroll (or re-confirm) a member in Pack Rewards: validates 21+ and state,
 * records the attestations in the append-only consent log, then grants the
 * one-time signup bonus if the member never received one.
 *
 * Under-21 entries close the rewards account (DISCUS: deny access to anyone
 * under the legal purchase age); staff can reopen it for a genuine typo.
 */
export async function enrollMember(
  admin: SupabaseClient,
  request: EnrollmentRequest
): Promise<EnrollmentResult> {
  const birthdate = parseBirthdate(request.birthdate)
  if (!birthdate) return { ok: false, error: 'invalid_birthdate' }

  const { data: member } = await admin
    .from('loyalty_members')
    .select('id, email, program_status, is_trade_account')
    .eq('id', request.memberId)
    .maybeSingle()
  if (!member) return { ok: false, error: 'member_not_found' }
  if (member.program_status === 'closed') return { ok: false, error: 'account_closed' }

  if (!isOfLegalAge(birthdate)) {
    await admin
      .from('loyalty_members')
      .update({
        program_status: 'closed',
        program_status_reason: 'Entered a birthdate under 21 at enrollment',
      })
      .eq('id', member.id)
    return { ok: false, error: 'under_age' }
  }

  const state = normalizeStateCode(request.residenceState)
  if (!state) return { ok: false, error: 'invalid_state' }
  if (!engagementAllowed(state)) return { ok: false, error: 'state_not_eligible' }

  const a = request.attestations
  if (!a.ofAge || !a.notTrade || !a.acceptsRules || !a.disclosesReferrals) {
    return { ok: false, error: 'attestations_required' }
  }
  if (member.is_trade_account) return { ok: false, error: 'trade_account' }
  if (member.program_status === 'suspended') return { ok: false, error: 'account_closed' }

  const now = new Date().toISOString()

  const { error: updateError } = await admin
    .from('loyalty_members')
    .update({
      birthdate,
      residence_state: state,
      program_enrolled_at: now,
      program_terms_version: PROGRAM_RULES_VERSION,
    })
    .eq('id', member.id)
  if (updateError) throw new Error(`Enrollment update failed: ${updateError.message}`)

  await admin.from('loyalty_program_consents').insert({
    member_id: member.id,
    auth_user_id: request.authUserId,
    terms_version: PROGRAM_RULES_VERSION,
    residence_state: state,
    birthdate,
    attestations: {
      of_age: true,
      not_trade: true,
      accepts_rules: true,
      discloses_referrals: true,
    },
    ip_hash: request.ipHash,
    user_agent: request.userAgent,
  })

  // One-time signup bonus (members who got one under the old program keep it).
  // The locked RPC checks for a prior signup_bonus row and credits under the
  // member-row lock, so two concurrent enrollments can't both grant it.
  let bonusGranted = 0
  const { data: granted, error: bonusError } = await admin.rpc('loyalty_grant_signup_bonus', {
    p_member_id: member.id,
    p_points: POINTS.SIGNUP_BONUS,
    p_description: 'Welcome to Pack Rewards! Signup bonus.',
  })
  if (bonusError) throw new Error(`loyalty_grant_signup_bonus failed: ${bonusError.message}`)
  if (granted === true) bonusGranted = POINTS.SIGNUP_BONUS

  // While Pack Rewards runs as a staff preview, online orders still credit
  // points at purchase and referrers are credited at signup (the current
  // flow), so there are no held order points or pending referral credits to
  // release here yet.
  return { ok: true, bonusGranted, orderPointsCredited: 0, referrerCredited: false }
}
