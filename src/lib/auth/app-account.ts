/**
 * Marks login accounts this app created.
 *
 * Supabase's public sign-up endpoint can be called by anyone with the public
 * key, and the app can't turn it off from code. An account made that way can
 * hold a confirmed copy of a customer's email and a password someone else
 * chose. The app never uses public sign-up, so it marks every account it
 * creates in app_metadata, which only the service role can write, and links
 * member and lead records only to marked accounts (here and in the
 * link_auth_user_to_identities database trigger, migration 00041).
 */
export const APP_ACCOUNT_FLAG = 'untamed_portal'

/** Pass as `app_metadata` to auth.admin.createUser. */
export const APP_ACCOUNT_METADATA = { [APP_ACCOUNT_FLAG]: true } as const

export function isAppAccount(
  user: { app_metadata?: Record<string, unknown> | null } | null | undefined
): boolean {
  return user?.app_metadata?.[APP_ACCOUNT_FLAG] === true
}
