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
