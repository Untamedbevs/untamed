import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface PortalLoyaltyMember {
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
}

/**
 * Resolve the current authenticated end-user (loyalty + distributor identities).
 * Returns null if not authenticated. Returns a `PortalMember` even when the
 * user has no loyalty/distributor record yet (so the portal can show a
 * "Join the loyalty program" CTA).
 */
export async function resolveMember(): Promise<PortalMember | null> {
  try {
    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user || !user.email) return null

    const admin = createAdminClient()

    const [loyaltyRes, distributorRes] = await Promise.all([
      admin
        .from('loyalty_members')
        .select('id, email, first_name, points_balance, favorite_drink_slug, created_at')
        .eq('auth_user_id', user.id)
        .maybeSingle(),
      admin
        .from('distributor_leads')
        .select('id, email, business_name, contact_name, status, created_at')
        .eq('auth_user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    let referralParticipant: PortalReferralParticipant | null = null
    if (loyaltyRes.data?.id) {
      const { data: rp } = await admin
        .from('referral_participants')
        .select(
          'id, referral_code, display_name, is_active, consumer_signups, distributor_leads, paid_conversions'
        )
        .eq('loyalty_member_id', loyaltyRes.data.id)
        .maybeSingle()
      referralParticipant = rp || null
    }

    return {
      authUserId: user.id,
      email: user.email,
      loyaltyMember: loyaltyRes.data || null,
      distributorLeads: distributorRes.data || [],
      referralParticipant,
    }
  } catch {
    return null
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
