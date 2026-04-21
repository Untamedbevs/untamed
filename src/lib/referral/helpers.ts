import { SupabaseClient } from '@supabase/supabase-js'
import { RESERVED_CODES, CODE_REGEX } from './constants'

export function isValidReferralCode(code: string): { valid: boolean; error?: string } {
  if (code.length < 2 || code.length > 20) {
    return { valid: false, error: 'Code must be 2-20 characters' }
  }
  if (!CODE_REGEX.test(code)) {
    return {
      valid: false,
      error: 'Code can only contain lowercase letters, numbers, and hyphens (cannot start or end with hyphen)',
    }
  }
  if (RESERVED_CODES.has(code)) {
    return { valid: false, error: 'This code is reserved' }
  }
  return { valid: true }
}

function generateCodeFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15) || 'untamed'
}

export async function generateUniqueCode(
  supabase: SupabaseClient,
  baseName: string
): Promise<string> {
  const baseCode = generateCodeFromName(baseName)
  let candidate = baseCode

  for (let i = 0; i < 100; i++) {
    const { data: existing } = await supabase
      .from('referral_participants')
      .select('id')
      .eq('referral_code', candidate)
      .maybeSingle()

    const { data: historyHit } = await supabase
      .from('referral_code_history')
      .select('id')
      .eq('old_code', candidate)
      .maybeSingle()

    if (!existing && !historyHit) return candidate

    candidate = `${baseCode}${Math.floor(Math.random() * 9000) + 1000}`
  }

  return `${baseCode}${Date.now().toString(36).slice(-6)}`
}

export async function resolveReferralCode(
  supabase: SupabaseClient,
  code: string
): Promise<{
  id: string
  email: string
  referral_code: string
  display_name: string | null
  loyalty_member_id: string
} | null> {
  const { data: participant } = await supabase
    .from('referral_participants')
    .select('id, email, referral_code, display_name, loyalty_member_id')
    .eq('referral_code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (participant) return participant

  const { data: history } = await supabase
    .from('referral_code_history')
    .select('participant_id')
    .eq('old_code', code)
    .maybeSingle()

  if (!history) return null

  const { data: fromHistory } = await supabase
    .from('referral_participants')
    .select('id, email, referral_code, display_name, loyalty_member_id')
    .eq('id', history.participant_id)
    .eq('is_active', true)
    .maybeSingle()

  return fromHistory
}

export async function checkAndGrantRewards(
  supabase: SupabaseClient,
  participantId: string,
  consumerSignups: number,
  distributorLeads: number,
  paidConversions: number
): Promise<void> {
  const { data: tiers } = await supabase
    .from('referral_reward_tiers')
    .select('id, tier_order, min_consumer_signups, min_distributor_leads, min_paid_conversions')
    .eq('is_active', true)
    .order('tier_order', { ascending: true })

  if (!tiers?.length) return

  const { data: existingRewards } = await supabase
    .from('referral_rewards_earned')
    .select('tier_id')
    .eq('participant_id', participantId)

  const earnedTierIds = new Set(existingRewards?.map((r) => r.tier_id) || [])

  for (const tier of tiers) {
    if (earnedTierIds.has(tier.id)) continue
    if (
      consumerSignups >= tier.min_consumer_signups &&
      distributorLeads >= tier.min_distributor_leads &&
      paidConversions >= tier.min_paid_conversions
    ) {
      await supabase.from('referral_rewards_earned').insert({
        participant_id: participantId,
        tier_id: tier.id,
      })
    }
  }
}
