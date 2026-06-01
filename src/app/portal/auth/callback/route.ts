import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureMemberForAuthUser } from '@/lib/auth/link-identities'
import { creditConsumerReferral } from '@/lib/referral/helpers'
import { REF_COOKIE_NAME } from '@/lib/referral/constants'

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
    const meta = user.user_metadata || {}
    const firstName =
      (meta.first_name as string | undefined) ||
      (meta.full_name as string | undefined)?.split(' ')[0] ||
      null
    const admin = createAdminClient()
    const result = await ensureMemberForAuthUser(admin, user.id, user.email, {
      firstName,
      favoriteDrinkSlug:
        (meta.favorite_drink_slug as string | undefined) || null,
      visitorId: (meta.visitor_id as string | undefined) || null,
    })

    if (result?.created) {
      const refCode = request.cookies.get(REF_COOKIE_NAME)?.value
      if (refCode) {
        await creditConsumerReferral(admin, refCode, user.email)
      }
    }
  }

  return NextResponse.redirect(new URL(safeReturnTo, url.origin))
}
