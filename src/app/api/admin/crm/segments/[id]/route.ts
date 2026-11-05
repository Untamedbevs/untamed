export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMemberDataStaff } from '@/lib/auth/resolve-staff'
import { parseSegmentFilters } from '@/lib/crm/segments'
import { queryRecipients } from '@/lib/crm/blast-filters'
import { filterSuppressed } from '@/lib/messaging/suppressions'

type Ctx = { params: Promise<{ id: string }> }

/** PATCH { name?, description?, filters?, recount? } */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const staff = await resolveMemberDataStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = (await request.json()) as {
    name?: string
    description?: string
    filters?: unknown
    recount?: boolean
  }

  const admin = createAdminClient()
  const update: Record<string, unknown> = {}
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    update.name = body.name.trim()
  }
  if (body.description !== undefined) update.description = body.description.trim() || null
  if (body.filters !== undefined) {
    const filters = parseSegmentFilters(body.filters)
    if (!filters) return NextResponse.json({ error: 'Filters must include an audience' }, { status: 400 })
    update.filters = filters
  }

  if (body.recount) {
    let filters = update.filters as ReturnType<typeof parseSegmentFilters>
    if (!filters) {
      const { data } = await admin.from('email_segments').select('filters').eq('id', id).single()
      filters = parseSegmentFilters(data?.filters)
    }
    if (filters) {
      const { allowed } = await filterSuppressed(await queryRecipients(filters))
      update.last_count = allowed.length
      update.last_counted_at = new Date().toISOString()
    }
  }

  const { data, error } = await admin.from('email_segments').update(update).eq('id', id).select('*').single()
  if (error) {
    const msg = error.code === '23505' ? 'A segment with that name already exists' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ segment: data })
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const staff = await resolveMemberDataStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { error } = await createAdminClient().from('email_segments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
