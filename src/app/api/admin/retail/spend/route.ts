import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { z } from 'zod'

const schema = z.object({
  spend_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  platform: z.enum(['google', 'meta', 'other']),
  campaign_name: z.string().max(200).optional(),
  campaign_id: z.string().max(200).optional(),
  spend: z.number().min(0),
  impressions: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
})

export async function GET(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = Math.min(90, Math.max(7, Number(request.nextUrl.searchParams.get('days')) || 30))
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ad_spend_daily')
    .select('*')
    .gte('spend_date', since)
    .order('spend_date', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to load spend' }, { status: 500 })
  return NextResponse.json({ rows: data || [] })
}

export async function POST(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ad_spend_daily')
    .insert({
      ...parsed.data,
      campaign_name: parsed.data.campaign_name || null,
      campaign_id: parsed.data.campaign_id || null,
      impressions: parsed.data.impressions || 0,
      clicks: parsed.data.clicks || 0,
      source: 'manual',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to save spend' }, { status: 500 })
  return NextResponse.json({ row: data })
}
