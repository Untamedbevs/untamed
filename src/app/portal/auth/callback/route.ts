import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureMemberForAuthUser } from '@/lib/auth/link-identities'
import { creditConsumerReferral } from '@/lib/referral/helpers'
import { REF_COOKIE_NAME } from '@/lib/referral/constants'

/**
 * Magic-link callback. Supabase redirects here after the user clicks the email
 * link, with either `?code=...` (PKCE) or `?token_hash=...&type=...` depending
 * on the email template. We establish the session cookie, provision the member,
 * then redirect to `returnTo` (defaults to `/portal`).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const returnTo = url.searchParams.get('returnTo') || '/portal'

  const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/portal'

  const supabase = await createClient()

  let authError: string | null = null
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) authError = error.message
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    if (error) authError = error.message
  } else {
    authError = 'Missing authorization code'
  }

  if (authError) {
    return NextResponse.redirect(
      new URL(
        `/portal/login?error=${encodeURIComponent(authError)}`,
        url.origin
      )
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let meta: Record<string, unknown> = {}
  if (user?.email) {
    meta = user.user_metadata || {}
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

  // First-time members with no password yet get a one-time prompt to set one.
  const needsPassword =
    meta.has_password !== true && meta.password_setup_skipped !== true
  if (needsPassword) {
    return NextResponse.redirect(
      new URL(
        `/portal/setup-password?returnTo=${encodeURIComponent(safeReturnTo)}`,
        url.origin
      )
    )
  }

  return NextResponse.redirect(new URL(safeReturnTo, url.origin))
}
