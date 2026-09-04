import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { parseLocationWrite } from '@/lib/retail/locations'

export async function GET() {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('retail_locations')
      .select('*')
      .order('city', { ascending: true })

    if (error) throw error
    return NextResponse.json({ locations: data || [] })
  } catch {
    return NextResponse.json({ error: 'Failed to load locations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await request.json()) as Record<string, unknown>
    const parsed = parseLocationWrite(body, false)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('retail_locations')
      .insert(parsed.row)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ location: data })
  } catch {
    return NextResponse.json({ error: 'Failed to create location' }, { status: 500 })
  }
}
