import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolveAdmin } from '@/lib/auth/resolve-staff'
import { endViewAs, startViewAs, VIEW_AS_MODES, type ViewAsMode } from '@/lib/auth/view-as'

export const dynamic = 'force-dynamic'

const RESULT_LIMIT = 25

/**
 * GET /api/admin/view-as?q= — find members to view as, by email, first name,
 * or referral code. Without q, the newest members.
 */
export async function GET(request: NextRequest) {
  const viewer = await resolveAdmin()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admin = createAdminClient()
    // Characters that would break PostgREST's or() filter syntax.
    const q = (request.nextUrl.searchParams.get('q') || '').replace(/[,()*%\\]/g, ' ').trim()

    let query = admin
      .from('loyalty_members')
      .select('id, email, first_name, points_balance, auth_user_id, program_enrolled_at, created_at')
      .order('created_at', { ascending: false })
      .limit(RESULT_LIMIT)

    if (q) {
      const { data: byCode } = await admin
        .from('referral_participants')
        .select('loyalty_member_id')
        .ilike('referral_code', q)
        .not('loyalty_member_id', 'is', null)
        .limit(5)
      const filters = [`email.ilike.%${q}%`, `first_name.ilike.%${q}%`]
      const codeMemberIds = (byCode || []).map((r) => r.loyalty_member_id as string)
      if (codeMemberIds.length) filters.push(`id.in.(${codeMemberIds.join(',')})`)
      query = query.or(filters.join(','))
    }

    const { data: members, error } = await query
    if (error) throw error

    const ids = (members || []).map((m) => m.id as string)
    const { data: participants } = ids.length
      ? await admin.from('referral_participants').select('loyalty_member_id, referral_code').in('loyalty_member_id', ids)
      : { data: [] }
    const codes = new Map((participants || []).map((p) => [p.loyalty_member_id as string, p.referral_code as string]))

    return NextResponse.json({
      members: (members || []).map((m) => ({
        id: m.id,
        email: m.email,
        firstName: m.first_name,
        pointsBalance: m.points_balance ?? 0,
        hasLogin: !!m.auth_user_id,
        enrolled: !!m.program_enrolled_at,
        referralCode: codes.get(m.id as string) ?? null,
        createdAt: m.created_at,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to search members' }, { status: 500 })
  }
}

/** POST /api/admin/view-as { memberId, mode } — start a read-only View As session. */
export async function POST(request: NextRequest) {
  const viewer = await resolveAdmin()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const memberId = typeof body?.memberId === 'string' ? body.memberId : ''
  const mode: ViewAsMode = VIEW_AS_MODES.includes(body?.mode) ? body.mode : 'current'
  if (!memberId) return NextResponse.json({ error: 'memberId is required' }, { status: 400 })

  const { data: member } = await createAdminClient()
    .from('loyalty_members')
    .select('id, email')
    .eq('id', memberId)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await startViewAs(user.id, member.id as string, mode)
  console.info(
    JSON.stringify({ event: 'view_as_start', admin: viewer.email, memberId: member.id, memberEmail: member.email, mode })
  )
  return NextResponse.json({ ok: true, redirectTo: '/portal' })
}

/** DELETE /api/admin/view-as — end View As. Anyone can clear their own session. */
export async function DELETE() {
  const viewer = await resolveAdmin()
  await endViewAs()
  console.info(JSON.stringify({ event: 'view_as_end', admin: viewer?.email ?? null }))
  return NextResponse.json({ ok: true, redirectTo: '/admin/view-as' })
}
