import { createAdminClient } from '@/lib/supabase/admin'
import type { BlastRecipient } from '@/lib/crm/blast-filters'

const IN_CHUNK = 500

/**
 * Each recipient's own active referral code, keyed by lowercased email.
 * Referrers match on their participant id, loyalty members on the participant
 * linked to their loyalty account, and anyone else on email. Recipients with
 * no active participant are left out of the map.
 */
export async function fetchReferralCodes(
  recipients: Pick<BlastRecipient, 'email' | 'loyaltyMemberId' | 'referralParticipantId'>[]
): Promise<Map<string, string>> {
  const admin = createAdminClient()
  const byParticipant = new Map<string, string>()
  const byLoyalty = new Map<string, string>()
  const byEmail = new Map<string, string>()

  type Row = { id: string; email: string | null; referral_code: string; loyalty_member_id: string | null }
  const remember = (rows: Row[] | null) => {
    for (const p of rows || []) {
      byParticipant.set(p.id, p.referral_code)
      if (p.loyalty_member_id) byLoyalty.set(p.loyalty_member_id, p.referral_code)
      if (p.email) byEmail.set(p.email.toLowerCase(), p.referral_code)
    }
  }

  const lookup = async (column: 'id' | 'loyalty_member_id' | 'email', values: string[]) => {
    const unique = [...new Set(values)]
    for (let i = 0; i < unique.length; i += IN_CHUNK) {
      const { data, error } = await admin
        .from('referral_participants')
        .select('id, email, referral_code, loyalty_member_id')
        .eq('is_active', true)
        .in(column, unique.slice(i, i + IN_CHUNK))
      if (error) throw new Error(`Referral code lookup failed: ${error.message}`)
      remember(data as Row[] | null)
    }
  }

  await lookup('id', recipients.flatMap((r) => (r.referralParticipantId ? [r.referralParticipantId] : [])))
  await lookup('loyalty_member_id', recipients.flatMap((r) => (r.loyaltyMemberId ? [r.loyaltyMemberId] : [])))

  const unresolved = recipients.filter(
    (r) =>
      !(r.referralParticipantId && byParticipant.has(r.referralParticipantId)) &&
      !(r.loyaltyMemberId && byLoyalty.has(r.loyaltyMemberId))
  )
  await lookup('email', unresolved.map((r) => r.email))

  const codes = new Map<string, string>()
  for (const r of recipients) {
    const code =
      (r.referralParticipantId && byParticipant.get(r.referralParticipantId)) ||
      (r.loyaltyMemberId && byLoyalty.get(r.loyaltyMemberId)) ||
      byEmail.get(r.email.toLowerCase())
    if (code) codes.set(r.email.toLowerCase(), code)
  }
  return codes
}
