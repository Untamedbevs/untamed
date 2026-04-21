import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, admin_notes } = body

    const supabase = createAdminClient()

    const updates: Record<string, unknown> = {}
    if (status) updates.status = status
    if (admin_notes !== undefined) updates.admin_notes = admin_notes

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const { data: lead, error } = await supabase
      .from('distributor_leads')
      .update(updates)
      .eq('id', id)
      .select('*, referrer:referral_participants(email, display_name, referral_code)')
      .single()

    if (error) throw error

    return NextResponse.json({ lead })
  } catch {
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}
