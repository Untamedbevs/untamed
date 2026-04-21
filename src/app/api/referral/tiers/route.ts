import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data: tiers, error } = await supabase
      .from('referral_reward_tiers')
      .select('*')
      .eq('is_active', true)
      .order('tier_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({ tiers: tiers || [] })
  } catch {
    return NextResponse.json({ error: 'Failed to load tiers' }, { status: 500 })
  }
}
