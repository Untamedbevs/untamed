import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureMemberForAuthUser } from '@/lib/auth/link-identities'
import { creditConsumerReferral } from '@/lib/referral/helpers'
import { REF_COOKIE_NAME } from '@/lib/referral/constants'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const meta = user.user_metadata || {}
  const firstName =
    (meta.first_name as string | undefined) ||
    (meta.full_name as string | undefined)?.split(' ')[0] ||
    null

  const admin = createAdminClient()
  const result = await ensureMemberForAuthUser(admin, user.id, user.email, {
    firstName,
    favoriteDrinkSlug: (meta.favorite_drink_slug as string | undefined) || null,
    visitorId: (meta.visitor_id as string | undefined) || null,
  })

  // Credit the referrer only when this signup just created the member, so a
  // referral is counted once (not on every subsequent login).
  if (result?.created) {
    const refCode = request.cookies.get(REF_COOKIE_NAME)?.value
    if (refCode) {
      await creditConsumerReferral(admin, refCode, user.email)
    }
  }

  return NextResponse.json({ ok: true, created: result?.created ?? false })
}
