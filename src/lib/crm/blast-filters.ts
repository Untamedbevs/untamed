/**
 * Audience query layer for the Untamed blast system.
 *
 * Resolves a `BlastFilters` object into a deduped list of addresses pulled
 * from `loyalty_orders`, `loyalty_members`, `referral_participants`, and
 * `distributor_leads`. This only narrows WHO a send is aimed at; consent,
 * suppression, age, and country rules are applied afterwards by
 * `getMarketingRecipients()` in `@/lib/messaging/consent`.
 *
 * Reads page through results (PostgREST caps each response at 1,000 rows)
 * and chunk large `in` lists so long audiences aren't silently truncated.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { Audience } from '@/lib/crm/blast-constants'

export type { Audience } from '@/lib/crm/blast-constants'

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

  // UGC
  ugc_status?: 'any' | 'pending' | 'approved' | 'featured' | 'rejected' | 'none'
  min_ugc_submissions?: number

  // Customers (online orders)
  ordered_after?: string
  ordered_before?: string
  min_orders?: number
  min_total_spent?: number
  bought_product?: string

  // Any audience, from the contact record
  state?: string
  engaged_within_days?: number
  not_engaged_days?: number

  // Shared
  created_after?: string
  created_before?: string
}

export interface BlastRecipient {
  email: string
  name: string
  firstName: string
  type: 'customer' | 'loyalty' | 'referrer' | 'distributor'
  loyaltyMemberId?: string
  referralParticipantId?: string
  distributorLeadId?: string
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>

const PAGE_SIZE = 1000
const MAX_ROWS = 100_000
const IN_CHUNK = 200

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/** Read every row of a query, one page at a time. Throws on error. */
async function fetchAllRows<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Audience query failed: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

/** Run a query once per chunk of ids and concatenate the results. */
async function fetchInChunks<T>(ids: string[], page: (chunk: string[], from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    rows.push(...(await fetchAllRows((from, to) => page(chunk, from, to))))
  }
  return rows
}

// ---------------------------------------------------------------------------
// Top-level query
// ---------------------------------------------------------------------------

/**
 * Addresses matching the filters. Not valid for the 'subscribers' audience,
 * which means "everyone on the list" and needs no lookup.
 */
export async function queryRecipients(filters: BlastFilters): Promise<BlastRecipient[]> {
  const admin = createAdminClient()
  const recipients: BlastRecipient[] = []
  const seenEmails = new Set<string>()

  const add = (rows: BlastRecipient[]) => {
    for (const r of rows) {
      const key = r.email.trim().toLowerCase()
      if (!key || seenEmails.has(key)) continue
      seenEmails.add(key)
      recipients.push({ ...r, email: key })
    }
  }

  const all = filters.audience === 'all'
  if (all || filters.audience === 'customers') add(await queryCustomers(admin, filters))
  if (all || filters.audience === 'loyalty') add(await queryLoyalty(admin, filters))
  if (all || filters.audience === 'referrers') add(await queryReferrers(admin, filters))
  if (all || filters.audience === 'distributors') add(await queryDistributors(admin, filters))

  return recipients
}

// ---------------------------------------------------------------------------
// Past customers (online orders)
// ---------------------------------------------------------------------------

async function queryCustomers(
  supabase: SupabaseAdmin,
  filters: BlastFilters
): Promise<BlastRecipient[]> {
  const orders = await fetchAllRows<{
    email: string
    created_at: string | null
    member_id: string | null
    total_cents: number | null
    items: { title?: string }[] | null
  }>(
    (from, to) =>
      supabase
        .from('loyalty_orders')
        .select('email, created_at, member_id, total_cents, items')
        .order('created_at', { ascending: true })
        .range(from, to)
  )
  const product = filters.bought_product?.trim().toLowerCase() || null

  const after = filters.ordered_after ? new Date(filters.ordered_after).getTime() : null
  // An end date includes that whole day.
  const before = filters.ordered_before
    ? new Date(filters.ordered_before).getTime() + (filters.ordered_before.length <= 10 ? 86_400_000 - 1 : 0)
    : null

  const byEmail = new Map<string, { count: number; inWindow: boolean; memberId: string | null; spentCents: number; boughtProduct: boolean }>()
  for (const o of orders) {
    const email = o.email?.trim().toLowerCase()
    if (!email) continue
    const t = o.created_at ? new Date(o.created_at).getTime() : NaN
    const inWindow =
      (after === null || (Number.isFinite(t) && t >= after)) &&
      (before === null || (Number.isFinite(t) && t <= before))
    const entry = byEmail.get(email) || { count: 0, inWindow: false, memberId: null, spentCents: 0, boughtProduct: false }
    entry.count += 1
    entry.inWindow = entry.inWindow || inWindow
    entry.memberId = entry.memberId || o.member_id
    entry.spentCents += o.total_cents || 0
    if (product && Array.isArray(o.items)) {
      entry.boughtProduct = entry.boughtProduct || o.items.some((it) => (it?.title || '').toLowerCase().includes(product))
    }
    byEmail.set(email, entry)
  }

  const out: BlastRecipient[] = []
  for (const [email, entry] of byEmail) {
    if (!entry.inWindow) continue
    if (filters.min_orders !== undefined && entry.count < filters.min_orders) continue
    if (filters.min_total_spent !== undefined && entry.spentCents < filters.min_total_spent * 100) continue
    if (product && !entry.boughtProduct) continue
    out.push({
      email,
      name: email,
      firstName: '',
      type: 'customer',
      loyaltyMemberId: entry.memberId || undefined,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Loyalty members
// ---------------------------------------------------------------------------

async function queryLoyalty(
  supabase: SupabaseAdmin,
  filters: BlastFilters
): Promise<BlastRecipient[]> {
  const members = await fetchAllRows<{
    id: string
    email: string | null
    first_name: string | null
  }>((from, to) => {
    let query = supabase
      .from('loyalty_members')
      .select('id, email, first_name, points_balance, favorite_drink_slug, first_utm_source, first_utm_campaign, created_at')
      .not('email', 'is', null)

    if (filters.points_min !== undefined) query = query.gte('points_balance', filters.points_min)
    if (filters.points_max !== undefined) query = query.lte('points_balance', filters.points_max)
    if (filters.favorite_drink_slug) query = query.eq('favorite_drink_slug', filters.favorite_drink_slug)
    if (filters.first_utm_source) query = query.ilike('first_utm_source', filters.first_utm_source)
    if (filters.first_utm_campaign) query = query.ilike('first_utm_campaign', filters.first_utm_campaign)
    if (filters.created_after) query = query.gte('created_at', filters.created_after)
    if (filters.created_before) query = query.lte('created_at', filters.created_before)

    return query.order('id').range(from, to)
  })

  let filtered = members

  if (filters.has_receipts !== undefined && filtered.length > 0) {
    const approved = await fetchInChunks<{ member_id: string }>(
      filtered.map((m) => m.id),
      (chunk, from, to) =>
        supabase
          .from('loyalty_receipts')
          .select('member_id')
          .in('member_id', chunk)
          .eq('status', 'approved')
          .range(from, to)
    )

    const idsWithReceipts = new Set(approved.map((r) => r.member_id))
    filtered = filtered.filter((m) =>
      filters.has_receipts ? idsWithReceipts.has(m.id) : !idsWithReceipts.has(m.id)
    )
  }

  filtered = await applyUgcFilter(supabase, filters, filtered, 'loyalty')

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
  const participants = await fetchAllRows<{
    id: string
    email: string | null
    display_name: string | null
  }>((from, to) => {
    let query = supabase
      .from('referral_participants')
      .select('id, email, display_name, is_active, consumer_signups, distributor_leads, paid_conversions, created_at')
      .not('email', 'is', null)

    if (filters.referrer_active !== undefined) query = query.eq('is_active', filters.referrer_active)
    if (filters.min_consumer_signups !== undefined) query = query.gte('consumer_signups', filters.min_consumer_signups)
    if (filters.min_distributor_leads !== undefined) query = query.gte('distributor_leads', filters.min_distributor_leads)
    if (filters.min_paid_conversions !== undefined) query = query.gte('paid_conversions', filters.min_paid_conversions)
    if (filters.created_after) query = query.gte('created_at', filters.created_after)
    if (filters.created_before) query = query.lte('created_at', filters.created_before)

    return query.order('id').range(from, to)
  })

  let filtered = participants

  if (filters.tier_name && filtered.length > 0) {
    const { data: tiers, error: tierError } = await supabase
      .from('referral_reward_tiers')
      .select('id')
      .eq('tier_name', filters.tier_name)
      .eq('is_active', true)
    if (tierError) throw new Error(`Audience query failed: ${tierError.message}`)

    const tierIds = (tiers || []).map((t) => t.id)
    if (tierIds.length === 0) {
      filtered = []
    } else {
      const earned = await fetchInChunks<{ participant_id: string }>(
        filtered.map((p) => p.id),
        (chunk, from, to) =>
          supabase
            .from('referral_rewards_earned')
            .select('participant_id')
            .in('participant_id', chunk)
            .in('tier_id', tierIds)
            .range(from, to)
      )

      const idsWithTier = new Set(earned.map((e) => e.participant_id))
      filtered = filtered.filter((p) => idsWithTier.has(p.id))
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
  const leads = await fetchAllRows<{
    id: string
    email: string | null
    contact_name: string | null
    business_name: string | null
  }>((from, to) => {
    let query = supabase
      .from('distributor_leads')
      .select('id, email, contact_name, business_name, status, business_type, volume_interest, referral_participant_id, created_at')
      .not('email', 'is', null)

    if (filters.distributor_status) query = query.eq('status', filters.distributor_status)
    if (filters.business_type) query = query.eq('business_type', filters.business_type)
    if (filters.volume_interest) query = query.eq('volume_interest', filters.volume_interest)
    if (filters.has_referrer === true) query = query.not('referral_participant_id', 'is', null)
    if (filters.has_referrer === false) query = query.is('referral_participant_id', null)
    if (filters.created_after) query = query.gte('created_at', filters.created_after)
    if (filters.created_before) query = query.lte('created_at', filters.created_before)

    return query.order('id').range(from, to)
  })

  const filtered = await applyUgcFilter(supabase, filters, leads, 'distributor')

  return filtered.map((l) => ({
    email: l.email!,
    name: l.contact_name || l.business_name || l.email!,
    firstName: (l.contact_name || '').split(' ')[0] || '',
    type: 'distributor' as const,
    distributorLeadId: l.id,
  }))
}

// ---------------------------------------------------------------------------
// UGC filter helper (works on loyalty members or distributor leads)
// ---------------------------------------------------------------------------

async function applyUgcFilter<T extends { id: string }>(
  supabase: SupabaseAdmin,
  filters: BlastFilters,
  rows: T[],
  ownerType: 'loyalty' | 'distributor'
): Promise<T[]> {
  if (rows.length === 0) return rows
  const ugcStatus = filters.ugc_status
  const minSubs = filters.min_ugc_submissions

  if (ugcStatus === undefined && minSubs === undefined) return rows

  const ownerColumn =
    ownerType === 'loyalty' ? 'loyalty_member_id' : 'distributor_lead_id'

  const subsList = await fetchInChunks<Record<string, unknown>>(
    rows.map((r) => r.id),
    (chunk, from, to) => {
      let q = supabase
        .from('ugc_submissions')
        .select(`${ownerColumn}, status`)
        .in(ownerColumn, chunk)

      if (ugcStatus && ugcStatus !== 'any' && ugcStatus !== 'none') {
        q = q.eq('status', ugcStatus)
      }
      return q.range(from, to) as unknown as PageResult<Record<string, unknown>>
    }
  )

  const counts = new Map<string, number>()
  for (const s of subsList) {
    const ownerId = s[ownerColumn]
    if (typeof ownerId !== 'string') continue
    counts.set(ownerId, (counts.get(ownerId) || 0) + 1)
  }

  return rows.filter((r) => {
    const c = counts.get(r.id) || 0
    if (ugcStatus === 'none') {
      if (c > 0) return false
    } else if (ugcStatus && ugcStatus !== 'any') {
      if (c === 0) return false
    }
    if (typeof minSubs === 'number' && c < minSubs) return false
    return true
  })
}

// ---------------------------------------------------------------------------
// Contact-level filters (any audience): state, engagement
// ---------------------------------------------------------------------------

export function hasContactFilters(filters: BlastFilters): boolean {
  return Boolean(filters.state || filters.engaged_within_days || filters.not_engaged_days)
}

/**
 * Narrow an address list (or, with null, every contact) by fields on the
 * contact record. Returns the matching addresses.
 */
export async function applyContactFilters(emails: string[] | null, filters: BlastFilters): Promise<string[]> {
  const admin = createAdminClient()
  const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

  const build = (chunk: string[] | null) => (from: number, to: number) => {
    let q = admin.from('email_contacts').select('email')
    if (chunk) q = q.in('email', chunk)
    if (filters.state) q = q.eq('state_code', filters.state.toUpperCase())
    if (filters.engaged_within_days) q = q.gte('last_engaged_at', since(filters.engaged_within_days))
    if (filters.not_engaged_days) {
      q = q.or(`last_engaged_at.is.null,last_engaged_at.lt.${since(filters.not_engaged_days)}`)
    }
    return q.order('email').range(from, to)
  }

  if (emails === null) {
    return (await fetchAllRows<{ email: string }>(build(null))).map((r) => r.email)
  }
  const out: string[] = []
  for (let i = 0; i < emails.length; i += IN_CHUNK) {
    const chunk = emails.slice(i, i + IN_CHUNK)
    out.push(...(await fetchAllRows<{ email: string }>(build(chunk))).map((r) => r.email))
  }
  return out
}
