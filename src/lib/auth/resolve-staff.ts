import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface StaffMember {
  id: string
  email: string
  full_name: string
  role: string
}

/**
 * Resolve the current authenticated staff member from the request session.
 * Returns the staff row or null if not authenticated / not an active staff member.
 */
export async function resolveStaff(): Promise<StaffMember | null> {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return null

    const admin = createAdminClient()
    const { data: staff } = await admin
      .from('staff')
      .select('id, email, full_name, role')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single()

    return staff || null
  } catch {
    return null
  }
}

/**
 * Active staff with access to member data (everyone except limited
 * contractors, matching the loyalty RLS policies). Use for admin APIs that
 * read or change loyalty members, receipts, points, or referrals.
 */
export async function resolveMemberDataStaff(): Promise<StaffMember | null> {
  const staff = await resolveStaff()
  return staff && staff.role !== 'contractor_limited' ? staff : null
}

export const ADMIN_ROLES = ['super_admin', 'admin']

/** Active admins and super admins, not contractors. Use for admin-only tools such as View As. */
export async function resolveAdmin(): Promise<StaffMember | null> {
  const staff = await resolveStaff()
  return staff && ADMIN_ROLES.includes(staff.role) ? staff : null
}
