import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdmin } from '@/lib/auth/resolve-staff'
import { PROMOTION_COLUMNS, type Promotion, type SubmissionStatus } from '@/lib/rewards/catalog'
import { parsePromotion } from '@/lib/rewards/admin-input'

export const dynamic = 'force-dynamic'

const STATUSES: SubmissionStatus[] = ['pending', 'approved', 'rejected']

/** GET /api/admin/promotions — every Hunt, newest first, with submission counts by status. */
export async function GET() {
  const staff = await resolveAdmin()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('promotions')
      .select(PROMOTION_COLUMNS)
      .order('created_at', { ascending: false })
    if (error) throw error

    const promotions = await Promise.all(
      ((data || []) as Promotion[]).map(async (p) => {
        const results = await Promise.all(
          STATUSES.map((status) =>
            admin
              .from('promotion_submissions')
              .select('id', { count: 'exact', head: true })
              .eq('promotion_id', p.id)
              .eq('status', status)
          )
        )
        const counts = {} as Record<SubmissionStatus, number>
        results.forEach(({ count, error: countError }, i) => {
          if (countError) throw countError
          counts[STATUSES[i]] = count ?? 0
        })
        return { ...p, counts }
      })
    )

    return NextResponse.json({ promotions })
  } catch (err) {
    console.error('[admin/promotions GET] Failed:', err)
    return NextResponse.json({ error: 'Failed to load Hunts' }, { status: 500 })
  }
}

/** POST /api/admin/promotions — create a Hunt. The slug comes from the title unless one is given. */
export async function POST(request: NextRequest) {
  const staff = await resolveAdmin()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = parsePromotion(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { data: promotion, error } = await createAdminClient()
    .from('promotions')
    .insert({ ...parsed.values, created_by: staff.id })
    .select(PROMOTION_COLUMNS)
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Another Hunt already uses that slug. Pick a different one.' }, { status: 409 })
    }
    console.error('[admin/promotions POST] Failed:', error)
    return NextResponse.json({ error: 'Failed to create Hunt' }, { status: 500 })
  }
  return NextResponse.json({ promotion: { ...promotion, counts: { pending: 0, approved: 0, rejected: 0 } } })
}
