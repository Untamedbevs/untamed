import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface StaffMember {
  id: string
  email: string
  full_name: string
  role: string
}

/** Limited contractors don't see customer contact or consent records. */
export function canViewContacts(role: string): boolean {
  return role !== 'contractor_limited'
}

/** Recording opt-ins, exporting, and deleting a person's data are admin actions. */
export function canManageContactData(role: string): boolean {
  return role === 'super_admin' || role === 'admin'
}

/** Drafting campaigns, templates, and flow copy. */
export function canDraftMarketing(role: string): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'contractor_full'
}

/**
 * Sending or scheduling marketing, approving someone else's campaign,
 * activating flows, and changing email settings.
 */
export function canSendMarketing(role: string): boolean {
  return role === 'super_admin' || role === 'admin'
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
