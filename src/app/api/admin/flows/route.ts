import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)

  const status = searchParams.get('status')

  let query = supabase
    .from('flows')
    .select(`
      *,
      created_by_staff:staff!flows_created_by_fkey(full_name),
      flow_posts(id, status)
    `)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('flows')
    .insert({
      title: body.title,
      concept: body.concept || null,
      status: body.status || 'planning',
      platform_targets: body.platform_targets || [],
      campaign_id: body.campaign_id || null,
      created_by: body.created_by || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
