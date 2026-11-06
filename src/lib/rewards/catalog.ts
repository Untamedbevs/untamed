import type { SupabaseClient } from '@supabase/supabase-js'
import { ENGAGEMENT_TYPES, isEngagementEntry } from '@/lib/referral-hq/program'

/**
 * Pack Rewards points program: the reward catalog, milestones on the points
 * trail, and promotions ("Hunts") members complete for points. Staff manage
 * all three in the admin; tables come from migration 00030.
 *
 * The trail runs on engagement points (enrolling, friends, approved content,
 * approved Hunts, staff bonuses), never purchases, so rewards are never a
 * rebate on alcohol.
 */

export type RewardKind = 'gift_card' | 'merch' | 'experience' | 'other'
export const REWARD_KINDS: { value: RewardKind; label: string }[] = [
  { value: 'gift_card', label: 'Gift card' },
  { value: 'merch', label: 'Merch' },
  { value: 'experience', label: 'Experience' },
  { value: 'other', label: 'Other' },
]

export interface RewardItem {
  id: string
  name: string
  description: string | null
  kind: RewardKind
  value_cents: number
  icon: string | null
  fulfillment_note: string | null
  is_active: boolean
  created_at: string
}

export interface Milestone {
  id: string
  points: number
  title: string
  tagline: string | null
  icon: string | null
  reward_id: string | null
  is_active: boolean
  reward?: RewardItem | null
}

export type ClaimStatus = 'pending' | 'fulfilled' | 'cancelled'

export interface MilestoneClaim {
  id: string
  member_id: string
  milestone_id: string
  reward_id: string | null
  reward_name: string
  reward_kind: RewardKind
  value_cents: number
  points_at_claim: number
  ship_state: string | null
  status: ClaimStatus
  staff_note: string | null
  fulfilled_at: string | null
  created_at: string
}

export type ProofMode = 'off' | 'optional' | 'required'
export const PROOF_MODES: ProofMode[] = ['off', 'optional', 'required']

export interface Promotion {
  id: string
  slug: string
  title: string
  summary: string | null
  instructions: string | null
  requirements: string[]
  review_checklist: string[]
  points: number
  url_mode: ProofMode
  image_mode: ProofMode
  text_mode: ProofMode
  url_hosts: string[]
  url_label: string | null
  icon: string | null
  starts_at: string | null
  ends_at: string | null
  max_per_member: number
  is_active: boolean
  created_at: string
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface PromotionSubmission {
  id: string
  promotion_id: string
  member_id: string
  proof_url: string | null
  proof_image_key: string | null
  proof_text: string | null
  attestations: string[]
  status: SubmissionStatus
  points_awarded: number
  review_note: string | null
  reviewed_at: string | null
  created_at: string
}

export const REWARD_ITEM_COLUMNS = 'id, name, description, kind, value_cents, icon, fulfillment_note, is_active, created_at'
export const MILESTONE_COLUMNS = 'id, points, title, tagline, icon, reward_id, is_active'
export const PROMOTION_COLUMNS =
  'id, slug, title, summary, instructions, requirements, review_checklist, points, url_mode, image_mode, text_mode, url_hosts, url_label, icon, starts_at, ends_at, max_per_member, is_active, created_at'
export const CLAIM_COLUMNS =
  'id, member_id, milestone_id, reward_id, reward_name, reward_kind, value_cents, points_at_claim, ship_state, status, staff_note, fulfilled_at, created_at'
export const SUBMISSION_COLUMNS =
  'id, promotion_id, member_id, proof_url, proof_image_key, proof_text, attestations, status, points_awarded, review_note, reviewed_at, created_at'

// ---------------------------------------------------------------------------
// Points trail
// ---------------------------------------------------------------------------

/** Lifetime engagement points: what the trail, ranks and milestones run on. Redeeming never lowers it. */
export async function trailPointsFor(admin: SupabaseClient, memberId: string): Promise<number> {
  const { data } = await admin
    .from('loyalty_transactions')
    .select('points, type')
    .eq('member_id', memberId)
    .in('type', ENGAGEMENT_TYPES)
  return (data || []).filter(isEngagementEntry).reduce((sum, e) => sum + (e.points as number), 0)
}

/** Active milestones, lowest first, each with its reward. */
export async function loadMilestones(admin: SupabaseClient, { includeInactive = false } = {}): Promise<Milestone[]> {
  let query = admin
    .from('reward_milestones')
    .select(`${MILESTONE_COLUMNS}, reward:reward_items(${REWARD_ITEM_COLUMNS})`)
    .order('points', { ascending: true })
  if (!includeInactive) query = query.eq('is_active', true)
  const { data } = await query
  return (data || []) as unknown as Milestone[]
}

export type MilestoneState = 'claimed' | 'claimable' | 'reached' | 'next' | 'locked'

/**
 * Where a member stands at each milestone. 'claimable' means reached with an
 * active reward not yet claimed; 'reached' is a marker with nothing to claim
 * (or an inactive reward).
 */
export function milestoneStates(points: number, milestones: Milestone[], claims: Pick<MilestoneClaim, 'milestone_id' | 'status'>[]) {
  const claimed = new Set(claims.filter((c) => c.status !== 'cancelled').map((c) => c.milestone_id))
  const next = milestones.find((m) => m.points > points) ?? null
  return milestones.map((m) => {
    let state: MilestoneState
    if (claimed.has(m.id)) state = 'claimed'
    else if (points >= m.points) state = m.reward?.is_active ? 'claimable' : 'reached'
    else state = m.id === next?.id ? 'next' : 'locked'
    return { milestone: m, state }
  })
}

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------

export type PromotionWindow = 'upcoming' | 'open' | 'ended'

export function promotionWindow(p: Pick<Promotion, 'starts_at' | 'ends_at'>, now = new Date()): PromotionWindow {
  if (p.starts_at && new Date(p.starts_at) > now) return 'upcoming'
  if (p.ends_at && new Date(p.ends_at) <= now) return 'ended'
  return 'open'
}

/** Active promotions members can see: open now or starting later. */
export async function loadLivePromotions(admin: SupabaseClient, now = new Date()): Promise<Promotion[]> {
  const { data } = await admin
    .from('promotions')
    .select(PROMOTION_COLUMNS)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  return ((data || []) as unknown as Promotion[]).filter((p) => promotionWindow(p, now) !== 'ended')
}

/** True if a link is https and on one of the allowed hosts (or a subdomain of one). */
export function linkAllowed(url: string, hosts: string[]): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (!hosts.length) return true
  const host = parsed.hostname.toLowerCase()
  return hosts.some((h) => host === h.toLowerCase() || host.endsWith(`.${h.toLowerCase()}`))
}

export interface ProofInput {
  url?: string | null
  imageKey?: string | null
  text?: string | null
}

/** Checks member proof against the promotion's settings. Returns an error message, or null when it's fine. */
export function proofProblem(p: Promotion, proof: ProofInput): string | null {
  const url = proof.url?.trim() || ''
  const imageKey = proof.imageKey?.trim() || ''
  const text = proof.text?.trim() || ''

  if (p.url_mode === 'required' && !url) return `Add your ${p.url_label || 'link'}.`
  if (p.image_mode === 'required' && !imageKey) return 'Add a screenshot.'
  if (p.text_mode === 'required' && !text) return 'Add a note.'
  if (p.url_mode === 'off' && url) return 'This Hunt doesn’t take links.'
  if (p.image_mode === 'off' && imageKey) return 'This Hunt doesn’t take screenshots.'
  if (p.text_mode === 'off' && text) return 'This Hunt doesn’t take notes.'
  if (!url && !imageKey && !text) return 'Add your proof.'
  if (url && !linkAllowed(url, p.url_hosts)) {
    return p.url_hosts.length
      ? `That link needs to be an https link on ${p.url_hosts.join(' or ')}.`
      : 'That link needs to start with https://.'
  }
  if (url.length > 2000 || text.length > 2000) return 'That’s too long.'
  return null
}

export function formatValue(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`
}
