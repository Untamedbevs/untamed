import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'

export async function GET() {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createAdminClient()
    const { data: leads, error } = await supabase
      .from('influencer_leads')
      .select('*')
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
    return NextResponse.json({ error: 'Failed to load creator applications' }, { status: 500 })
  }
}
