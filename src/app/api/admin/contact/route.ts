import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data: submissions, error } = await supabase
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    const statusCounts: Record<string, number> = {}
    for (const sub of submissions || []) {
      statusCounts[sub.status] = (statusCounts[sub.status] || 0) + 1
    }

    return NextResponse.json({
      submissions: submissions || [],
      statusCounts,
      total: submissions?.length || 0,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load contact submissions' }, { status: 500 })
  }
}
