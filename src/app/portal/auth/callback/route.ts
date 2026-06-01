import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { linkAuthUserToIdentitiesByEmail } from '@/lib/auth/link-identities'

/**
 * Magic-link OAuth callback. Supabase redirects here with `?code=...` after
 * the user clicks the email link. We exchange it for a session cookie, then
 * redirect to `returnTo` (defaults to `/portal`).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const returnTo = url.searchParams.get('returnTo') || '/portal'

  const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/portal'

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `/portal/login?error=${encodeURIComponent('Missing authorization code')}`,
        url.origin
      )
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/portal/login?error=${encodeURIComponent(error.message)}`,
        url.origin
      )
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user?.email) {
    await linkAuthUserToIdentitiesByEmail(
      createAdminClient(),
      user.id,
      user.email
    )
  }

  return NextResponse.redirect(new URL(safeReturnTo, url.origin))
}
