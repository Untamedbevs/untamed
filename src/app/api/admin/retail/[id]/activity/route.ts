import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { z } from 'zod'

const schema = z.object({
  activity_type: z.enum(['note', 'called', 'emailed', 'meeting', 'sample_sent']),
  body: z.string().max(4000).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: activity, error } = await supabase
      .from('lead_activities')
      .insert({
        lead_id: id,
        staff_id: staff.id,
        activity_type: parsed.data.activity_type,
        body: parsed.data.body || null,
      })
      .select('*, staff:staff_id(full_name, email)')
      .single()

    if (error) throw error

    if (parsed.data.activity_type === 'called' || parsed.data.activity_type === 'emailed') {
      const { data: lead } = await supabase
        .from('distributor_leads')
        .select('status, first_contacted_at')
        .eq('id', id)
        .single()

      const touch: Record<string, unknown> = {}
      if (lead && !lead.first_contacted_at) {
        touch.first_contacted_at = new Date().toISOString()
      }
      if (lead?.status === 'new') {
        touch.status = 'contacted'
      }
      if (Object.keys(touch).length > 0) {
        await supabase.from('distributor_leads').update(touch).eq('id', id)
      }
    }

    return NextResponse.json({ activity })
  } catch {
    return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 })
  }
}
