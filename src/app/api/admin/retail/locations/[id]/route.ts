import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { parseLocationWrite } from '@/lib/retail/locations'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const parsed = parseLocationWrite(body, Object.keys(body).length < 8)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('retail_locations')
      .update(parsed.row)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ location: data })
  } catch {
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { error } = await supabase.from('retail_locations').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 })
  }
}
