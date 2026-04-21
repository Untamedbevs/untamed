import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data: leads, error } = await supabase
      .from('distributor_leads')
      .select('*, referrer:referral_participants(email, display_name, referral_code)')
      .order('created_at', { ascending: false })

    if (error) throw error

    const statusCounts: Record<string, number> = {}
    for (const lead of leads || []) {
      statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1
    }

    return NextResponse.json({
      leads: leads || [],
      statusCounts,
      total: leads?.length || 0,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load distributor leads' }, { status: 500 })
  }
}
