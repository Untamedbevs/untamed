import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { linkAuthUserToIdentitiesByEmail } from '@/lib/auth/link-identities'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await linkAuthUserToIdentitiesByEmail(
    createAdminClient(),
    user.id,
    user.email
  )

  return NextResponse.json({ ok: true })
}
