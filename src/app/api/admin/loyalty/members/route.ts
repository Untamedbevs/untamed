import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search')
    const drinkSlug = searchParams.get('drink')
    const sortBy = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') === 'asc' ? true : false

    let query = supabase
      .from('loyalty_members')
      .select('*')
      .order(sortBy, { ascending: order })

    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%`)
    }

    if (drinkSlug) {
      query = query.eq('favorite_drink_slug', drinkSlug)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ members: data || [] })
  } catch {
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 })
  }
}
