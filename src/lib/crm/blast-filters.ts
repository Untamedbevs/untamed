/**
 * Audience query layer for the Untamed blast system.
 *
 * Resolves a `BlastFilters` object into a deduped recipient list pulled
 * from `loyalty_members`, `referral_participants`, and `distributor_leads`.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export type Audience = 'loyalty' | 'referrers' | 'distributors' | 'all'

export interface BlastFilters {
  audience: Audience

  // Loyalty
  points_min?: number
  points_max?: number
  has_receipts?: boolean
  favorite_drink_slug?: string
  first_utm_source?: string
  first_utm_campaign?: string

  // Referrers
  referrer_active?: boolean
  min_consumer_signups?: number
  min_distributor_leads?: number
  min_paid_conversions?: number
  tier_name?: string

  // Distributors
  distributor_status?: string
  business_type?: string
  volume_interest?: string
  has_referrer?: boolean

  // Shared
  created_after?: string
  created_before?: string
}

export interface BlastRecipient {
  email: string
  name: string
  firstName: string
  type: 'loyalty' | 'referrer' | 'distributor'
  loyaltyMemberId?: string
  referralParticipantId?: string
  distributorLeadId?: string
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>

const MAX_ROWS_PER_QUERY = 50_000

// ---------------------------------------------------------------------------
// Top-level query
// ---------------------------------------------------------------------------

export async function queryRecipients(filters: BlastFilters): Promise<BlastRecipient[]> {
  const admin = createAdminClient()
  const recipients: BlastRecipient[] = []
  const seenEmails = new Set<string>()

  const wantsLoyalty = filters.audience === 'loyalty' || filters.audience === 'all'
  const wantsReferrers = filters.audience === 'referrers' || filters.audience === 'all'
  const wantsDistributors = filters.audience === 'distributors' || filters.audience === 'all'

  if (wantsLoyalty) {
    const rows = await queryLoyalty(admin, filters)
    for (const r of rows) {
      const key = r.email.toLowerCase()
      if (!seenEmails.has(key)) {
        seenEmails.add(key)
        recipients.push(r)
      }
    }
  }

  if (wantsReferrers) {
    const rows = await queryReferrers(admin, filters)
    for (const r of rows) {
      const key = r.email.toLowerCase()
      if (!seenEmails.has(key)) {
        seenEmails.add(key)
        recipients.push(r)
      }
    }
  }

  if (wantsDistributors) {
    const rows = await queryDistributors(admin, filters)
    for (const r of rows) {
      const key = r.email.toLowerCase()
      if (!seenEmails.has(key)) {
        seenEmails.add(key)
        recipients.push(r)
      }
    }
  }

  return recipients
}

// ---------------------------------------------------------------------------
// Loyalty members
// ---------------------------------------------------------------------------

async function queryLoyalty(
  supabase: SupabaseAdmin,
  filters: BlastFilters
): Promise<BlastRecipient[]> {
  let query = supabase
    .from('loyalty_members')
    .select('id, email, first_name, points_balance, favorite_drink_slug, first_utm_source, first_utm_campaign, created_at')
    .not('email', 'is', null)
    .limit(MAX_ROWS_PER_QUERY)

  if (filters.points_min !== undefined) query = query.gte('points_balance', filters.points_min)
  if (filters.points_max !== undefined) query = query.lte('points_balance', filters.points_max)
  if (filters.favorite_drink_slug) query = query.eq('favorite_drink_slug', filters.favorite_drink_slug)
  if (filters.first_utm_source) query = query.ilike('first_utm_source', filters.first_utm_source)
  if (filters.first_utm_campaign) query = query.ilike('first_utm_campaign', filters.first_utm_campaign)
  if (filters.created_after) query = query.gte('created_at', filters.created_after)
  if (filters.created_before) query = query.lte('created_at', filters.created_before)

  const { data: members, error } = await query
  if (error || !members) return []

  let filtered = members

  if (filters.has_receipts !== undefined) {
    const memberIds = filtered.map((m) => m.id)
    if (memberIds.length > 0) {
      const { data: approved } = await supabase
        .from('loyalty_receipts')
        .select('member_id')
        .in('member_id', memberIds)
        .eq('status', 'approved')

      const idsWithReceipts = new Set((approved || []).map((r) => r.member_id))
      filtered = filtered.filter((m) =>
        filters.has_receipts ? idsWithReceipts.has(m.id) : !idsWithReceipts.has(m.id)
      )
    }
  }

  return filtered.map((m) => ({
    email: m.email!,
    name: m.first_name || m.email!,
    firstName: m.first_name || '',
    type: 'loyalty' as const,
    loyaltyMemberId: m.id,
  }))
}

// ---------------------------------------------------------------------------
// Referral participants
// ---------------------------------------------------------------------------

async function queryReferrers(
  supabase: SupabaseAdmin,
  filters: BlastFilters
): Promise<BlastRecipient[]> {
  let query = supabase
    .from('referral_participants')
    .select('id, email, display_name, is_active, consumer_signups, distributor_leads, paid_conversions, created_at')
    .not('email', 'is', null)
    .limit(MAX_ROWS_PER_QUERY)

  if (filters.referrer_active !== undefined) query = query.eq('is_active', filters.referrer_active)
  if (filters.min_consumer_signups !== undefined) query = query.gte('consumer_signups', filters.min_consumer_signups)
  if (filters.min_distributor_leads !== undefined) query = query.gte('distributor_leads', filters.min_distributor_leads)
  if (filters.min_paid_conversions !== undefined) query = query.gte('paid_conversions', filters.min_paid_conversions)
  if (filters.created_after) query = query.gte('created_at', filters.created_after)
  if (filters.created_before) query = query.lte('created_at', filters.created_before)

  const { data: participants, error } = await query
  if (error || !participants) return []

  let filtered = participants

  if (filters.tier_name) {
    const participantIds = filtered.map((p) => p.id)
    if (participantIds.length > 0) {
      const { data: tiers } = await supabase
        .from('referral_reward_tiers')
        .select('id')
        .eq('tier_name', filters.tier_name)
        .eq('is_active', true)

      const tierIds = (tiers || []).map((t) => t.id)
      if (tierIds.length === 0) {
        filtered = []
      } else {
        const { data: earned } = await supabase
          .from('referral_rewards_earned')
          .select('participant_id')
          .in('participant_id', participantIds)
          .in('tier_id', tierIds)

        const idsWithTier = new Set((earned || []).map((e) => e.participant_id))
        filtered = filtered.filter((p) => idsWithTier.has(p.id))
      }
    }
  }

  return filtered.map((p) => ({
    email: p.email!,
    name: p.display_name || p.email!,
    firstName: (p.display_name || '').split(' ')[0] || '',
    type: 'referrer' as const,
    referralParticipantId: p.id,
  }))
}

// ---------------------------------------------------------------------------
// Distributor leads
// ---------------------------------------------------------------------------

async function queryDistributors(
  supabase: SupabaseAdmin,
  filters: BlastFilters
): Promise<BlastRecipient[]> {
  let query = supabase
    .from('distributor_leads')
    .select('id, email, contact_name, business_name, status, business_type, volume_interest, referral_participant_id, created_at')
    .not('email', 'is', null)
    .limit(MAX_ROWS_PER_QUERY)

  if (filters.distributor_status) query = query.eq('status', filters.distributor_status)
  if (filters.business_type) query = query.eq('business_type', filters.business_type)
  if (filters.volume_interest) query = query.eq('volume_interest', filters.volume_interest)
  if (filters.has_referrer === true) query = query.not('referral_participant_id', 'is', null)
  if (filters.has_referrer === false) query = query.is('referral_participant_id', null)
  if (filters.created_after) query = query.gte('created_at', filters.created_after)
  if (filters.created_before) query = query.lte('created_at', filters.created_before)

  const { data: leads, error } = await query
  if (error || !leads) return []

  return leads.map((l) => ({
    email: l.email!,
    name: l.contact_name || l.business_name || l.email!,
    firstName: (l.contact_name || '').split(' ')[0] || '',
    type: 'distributor' as const,
    distributorLeadId: l.id,
  }))
}
