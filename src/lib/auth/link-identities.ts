import type { SupabaseClient } from '@supabase/supabase-js'

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
