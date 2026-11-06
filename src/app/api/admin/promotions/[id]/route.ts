import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdmin } from '@/lib/auth/resolve-staff'
import { PROMOTION_COLUMNS, type Promotion } from '@/lib/rewards/catalog'
import { parsePromotion } from '@/lib/rewards/admin-input'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/admin/promotions/[id] — edit any field. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const staff = await resolveAdmin()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { data: existing, error: loadError } = await admin
    .from('promotions')
    .select(PROMOTION_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (loadError) {
    console.error('[admin/promotions PATCH] Load failed:', loadError)
    return NextResponse.json({ error: 'Failed to load Hunt' }, { status: 500 })
  }
  if (!existing) return NextResponse.json({ error: 'Hunt not found' }, { status: 404 })

  const parsed = parsePromotion(await request.json().catch(() => null), existing as Promotion)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (!Object.keys(parsed.values).length) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
  }

  const { data: promotion, error } = await admin
    .from('promotions')
    .update(parsed.values)
    .eq('id', id)
    .select(PROMOTION_COLUMNS)
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Another Hunt already uses that slug. Pick a different one.' }, { status: 409 })
    }
    console.error('[admin/promotions PATCH] Failed:', error)
    return NextResponse.json({ error: 'Failed to update Hunt' }, { status: 500 })
  }
  if (!promotion) return NextResponse.json({ error: 'Hunt not found' }, { status: 404 })
  return NextResponse.json({ promotion })
}

/** DELETE /api/admin/promotions/[id] — only before anyone submits (submissions restrict the delete). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const staff = await resolveAdmin()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await createAdminClient().from('promotions').delete().eq('id', id).select('id')

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Members have sent proof for this Hunt. Deactivate it instead.' },
        { status: 409 }
      )
    }
    console.error('[admin/promotions DELETE] Failed:', error)
    return NextResponse.json({ error: 'Failed to delete Hunt' }, { status: 500 })
  }
  if (!data.length) return NextResponse.json({ error: 'Hunt not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
