import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureMemberForAuthUser } from '@/lib/auth/link-identities'
import { resolveAdmin } from '@/lib/auth/resolve-staff'
import { readViewAs, type ViewAsMode } from '@/lib/auth/view-as'
import { MEMBER_PROGRAM_COLUMNS, type MemberProgramFields } from '@/lib/rewards/eligibility'

export interface PortalLoyaltyMember extends MemberProgramFields {
  id: string
  email: string
  first_name: string | null
  points_balance: number
  favorite_drink_slug: string | null
  created_at: string
}

export interface PortalDistributorLead {
  id: string
  email: string
  business_name: string
  contact_name: string
  status: string
  created_at: string
}

export interface PortalReferralParticipant {
  id: string
  referral_code: string
  display_name: string | null
  is_active: boolean
  consumer_signups: number
  distributor_leads: number
  paid_conversions: number
}

export interface PortalMember {
  authUserId: string
  email: string
  loyaltyMember: PortalLoyaltyMember | null
  distributorLeads: PortalDistributorLead[]
  referralParticipant: PortalReferralParticipant | null
  /** Set when an admin is viewing the portal as this member (read-only). */
  viewAs?: { mode: ViewAsMode; adminEmail: string }
}

const LOYALTY_COLUMNS = `id, email, first_name, points_balance, favorite_drink_slug, created_at, ${MEMBER_PROGRAM_COLUMNS}`
const DISTRIBUTOR_COLUMNS = 'id, email, business_name, contact_name, status, created_at'
const PARTICIPANT_COLUMNS =
  'id, referral_code, display_name, is_active, consumer_signups, distributor_leads, paid_conversions'

/** Matches no auth user, so per-user lookups for a member without a login find nothing. */
const NO_AUTH_USER = '00000000-0000-0000-0000-000000000000'

/**
 * Resolve the current authenticated end-user (loyalty + distributor identities).
 * Returns null if not authenticated. Returns a `PortalMember` even when the
 * user has no loyalty/distributor record yet (so the portal can show a
 * "Join the loyalty program" CTA).
 *
 * When an active admin has a View As session, returns the member they are
 * viewing instead (see src/lib/auth/view-as.ts).
 */
export async function resolveMember(): Promise<PortalMember | null> {
  try {
    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user || !user.email) return null

    const admin = createAdminClient()

    const viewAs = await readViewAs(user.id)
    if (viewAs) {
      const viewer = await resolveAdmin()
      if (viewer) {
        return await resolveViewAsMember(admin, viewAs.memberId, {
          mode: viewAs.mode,
          adminEmail: viewer.email,
        })
      }
    }

    let loyaltyRes = await admin
      .from('loyalty_members')
      .select(LOYALTY_COLUMNS)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!loyaltyRes.data) {
      // Portal front door: link existing identities and, if this auth user
      // still has no loyalty member, provision one (+ signup bonus). This makes
      // having a portal account equivalent to being a loyalty member.
      const meta = user.user_metadata || {}
      const firstName =
        (meta.first_name as string | undefined) ||
        (meta.full_name as string | undefined)?.split(' ')[0] ||
        null
      await ensureMemberForAuthUser(admin, user.id, user.email, {
        firstName,
        favoriteDrinkSlug:
          (meta.favorite_drink_slug as string | undefined) || null,
        visitorId: (meta.visitor_id as string | undefined) || null,
      })
      loyaltyRes = await admin
        .from('loyalty_members')
        .select(LOYALTY_COLUMNS)
        .eq('auth_user_id', user.id)
        .maybeSingle()
    }

    const distributorRes = await admin
      .from('distributor_leads')
      .select(DISTRIBUTOR_COLUMNS)
      .eq('auth_user_id', user.id)
      .order('created_at', { ascending: false })

    let referralParticipant: PortalReferralParticipant | null = null
    if (loyaltyRes.data?.id) {
      const { data: rp } = await admin
        .from('referral_participants')
        .select(PARTICIPANT_COLUMNS)
        .eq('loyalty_member_id', loyaltyRes.data.id)
        .maybeSingle()
      referralParticipant = rp || null
    }

    return {
      authUserId: user.id,
      email: user.email,
      loyaltyMember: (loyaltyRes.data as unknown as PortalLoyaltyMember | null) || null,
      distributorLeads: distributorRes.data || [],
      referralParticipant,
    }
  } catch {
    return null
  }
}

/** A member's portal identities for View As. Read-only: never provisions or links anything. */
async function resolveViewAsMember(
  admin: SupabaseClient,
  memberId: string,
  viewAs: NonNullable<PortalMember['viewAs']>
): Promise<PortalMember | null> {
  const { data } = await admin
    .from('loyalty_members')
    .select(`${LOYALTY_COLUMNS}, auth_user_id`)
    .eq('id', memberId)
    .maybeSingle()
  if (!data) return null
  const { auth_user_id: authUserId, ...loyaltyMember } = data as unknown as PortalLoyaltyMember & {
    auth_user_id: string | null
  }

  const distributorLeads = authUserId
    ? (
        await admin
          .from('distributor_leads')
          .select(DISTRIBUTOR_COLUMNS)
          .eq('auth_user_id', authUserId)
          .order('created_at', { ascending: false })
      ).data
    : []
  const { data: referralParticipant } = await admin
    .from('referral_participants')
    .select(PARTICIPANT_COLUMNS)
    .eq('loyalty_member_id', memberId)
    .maybeSingle()

  return {
    authUserId: authUserId || NO_AUTH_USER,
    email: loyaltyMember.email,
    loyaltyMember,
    distributorLeads: distributorLeads || [],
    referralParticipant: referralParticipant || null,
    viewAs,
  }
}

/**
 * Lookup helper for API routes -- ensures the request comes from an authenticated
 * end user and returns their identities. Throws (caller turns into 401) if not.
 */
export async function requireMember(): Promise<PortalMember> {
  const member = await resolveMember()
  if (!member) {
    throw new Error('UNAUTHORIZED')
  }
  return member
}
