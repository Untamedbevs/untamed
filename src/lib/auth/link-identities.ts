import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { POINTS } from '@/lib/loyalty/constants'
import { claimPendingOrdersForMember } from '@/lib/loyalty/orders'
import { ensureReferralParticipant } from '@/lib/referral/helpers'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Mirrors the `link_auth_user_to_identities` DB trigger, but runs on demand.
 * The trigger only fires when auth.users is inserted; loyalty/referral rows
 * created afterward (e.g. via /referral join) stay unlinked until this runs.
 */
export async function linkAuthUserToIdentitiesByEmail(
  admin: SupabaseClient,
  authUserId: string,
  email: string
): Promise<void> {
  const normalized = email.toLowerCase().trim()
  if (!normalized) return

  const now = new Date().toISOString()

  await admin
    .from('loyalty_members')
    .update({ auth_user_id: authUserId, updated_at: now })
    .eq('email', normalized)
    .is('auth_user_id', null)

  await admin
    .from('distributor_leads')
    .update({ auth_user_id: authUserId, updated_at: now })
    .ilike('email', normalized)
    .is('auth_user_id', null)
}

export interface EnsureMemberResult {
  loyaltyMemberId: string
  created: boolean
}

export interface EnsureMemberOptions {
  firstName?: string | null
  favoriteDrinkSlug?: string | null
  /**
   * The visitor fingerprint (a UUID) captured by client tracking. When present
   * and matching a `visitors` row, first-touch attribution is copied onto the
   * new member, mirroring the legacy `/api/tracking/identify` waterfall.
   */
  visitorId?: string | null
}

/**
 * The portal front door: guarantees the authenticated user has a loyalty
 * member. First links any pre-existing loyalty/distributor rows by email, then
 * — if the auth user still has no loyalty member — creates one, grants the
 * signup bonus, copies first-touch attribution, and provisions a referral
 * participant. This is what makes "create a portal account" === "become a
 * loyalty member." Idempotent: only ever creates a member once per auth user.
 */
export async function ensureMemberForAuthUser(
  admin: SupabaseClient,
  authUserId: string,
  email: string,
  options: EnsureMemberOptions = {}
): Promise<EnsureMemberResult | null> {
  const normalized = email.toLowerCase().trim()
  if (!normalized) return null

  const firstName = options.firstName?.trim() || null

  // 1. Link any existing identity rows that share this email.
  await linkAuthUserToIdentitiesByEmail(admin, authUserId, normalized)

  // 2. Already a member (either pre-existing+just-linked, or linked earlier)?
  const { data: linked } = await admin
    .from('loyalty_members')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (linked?.id) {
    // Bank any online-order points that arrived before this account existed.
    try {
      await claimPendingOrdersForMember(admin, linked.id, normalized)
    } catch (err) {
      console.error('[ensureMemberForAuthUser] claim pending orders failed:', err)
    }
    return { loyaltyMemberId: linked.id, created: false }
  }

  // 3. Look up the visitor row (by fingerprint) for first-touch attribution.
  const fingerprint =
    options.visitorId && UUID_REGEX.test(options.visitorId)
      ? options.visitorId
      : null

  let visitor:
    | {
        id: string
        first_utm_source: string | null
        first_utm_medium: string | null
        first_utm_campaign: string | null
        first_landing_page: string | null
        first_referrer: string | null
        first_seen_at: string | null
      }
    | null = null

  if (fingerprint) {
    const { data } = await admin
      .from('visitors')
      .select(
        'id, first_utm_source, first_utm_medium, first_utm_campaign, first_landing_page, first_referrer, first_seen_at'
      )
      .eq('fingerprint', fingerprint)
      .maybeSingle()
    visitor = data || null
  }

  // 4. No membership yet — provision one. visitor_id is UUID NOT NULL, so use
  //    the tracked fingerprint when valid, else mint a synthetic UUID.
  const insertData: Record<string, unknown> = {
    email: normalized,
    first_name: firstName,
    favorite_drink_slug: options.favoriteDrinkSlug || null,
    visitor_id: fingerprint || randomUUID(),
    points_balance: POINTS.SIGNUP_BONUS,
    auth_user_id: authUserId,
  }

  if (visitor) {
    insertData.first_utm_source = visitor.first_utm_source
    insertData.first_utm_medium = visitor.first_utm_medium
    insertData.first_utm_campaign = visitor.first_utm_campaign
    insertData.first_landing_page = visitor.first_landing_page
    insertData.first_referrer = visitor.first_referrer
    insertData.first_seen_at = visitor.first_seen_at
  }

  const { data: created, error: insertError } = await admin
    .from('loyalty_members')
    .insert(insertData)
    .select('id')
    .single()

  if (insertError) {
    // Unique-email race: another request created/linked it first. Re-fetch.
    if (insertError.code === '23505') {
      await linkAuthUserToIdentitiesByEmail(admin, authUserId, normalized)
      const { data: existing } = await admin
        .from('loyalty_members')
        .select('id')
        .eq('email', normalized)
        .maybeSingle()
      if (existing?.id) {
        try {
          await claimPendingOrdersForMember(admin, existing.id, normalized)
        } catch (err) {
          console.error('[ensureMemberForAuthUser] claim pending orders failed:', err)
        }
        return { loyaltyMemberId: existing.id, created: false }
      }
    }
    console.error('[ensureMemberForAuthUser] insert failed:', insertError)
    return null
  }

  await admin.from('loyalty_transactions').insert({
    member_id: created.id,
    points: POINTS.SIGNUP_BONUS,
    type: 'signup_bonus',
    description: 'Welcome to the Pack! Signup bonus.',
  })

  // 5. Link the visitor row to the new member (waterfall completion).
  if (visitor) {
    await admin
      .from('visitors')
      .update({ loyalty_member_id: created.id })
      .eq('id', visitor.id)
  }

  // 6. Every loyalty member gets a referral link. Best-effort so a referral
  //    hiccup never blocks signup.
  try {
    await ensureReferralParticipant(admin, {
      loyaltyMemberId: created.id,
      email: normalized,
      displayName: firstName,
    })
  } catch (err) {
    console.error('[ensureMemberForAuthUser] referral participant failed:', err)
  }

  // 7. Claim any online-order points banked against this email pre-signup.
  try {
    await claimPendingOrdersForMember(admin, created.id, normalized)
  } catch (err) {
    console.error('[ensureMemberForAuthUser] claim pending orders failed:', err)
  }

  return { loyaltyMemberId: created.id, created: true }
}
