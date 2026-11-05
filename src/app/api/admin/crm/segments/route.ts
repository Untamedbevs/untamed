export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMemberDataStaff } from '@/lib/auth/resolve-staff'
import { parseSegmentFilters } from '@/lib/crm/segments'

export async function GET() {
  const staff = await resolveMemberDataStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await createAdminClient()
    .from('email_segments')
    .select('*')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ segments: data || [] })
}

export async function POST(request: NextRequest) {
  const staff = await resolveMemberDataStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as { name?: string; description?: string; filters?: unknown }
  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const filters = parseSegmentFilters(body.filters)
  if (!filters) return NextResponse.json({ error: 'Filters must include an audience' }, { status: 400 })

  const { data, error } = await createAdminClient()
    .from('email_segments')
    .insert({ name, description: body.description?.trim() || null, filters, created_by: staff.id })
    .select('*')
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'A segment with that name already exists' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ segment: data })
}
