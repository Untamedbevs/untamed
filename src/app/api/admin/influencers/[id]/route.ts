import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { INFLUENCER_STATUSES } from '@/lib/influencers/types'

const patchSchema = z.object({
  status: z.enum(INFLUENCER_STATUSES).optional(),
  admin_notes: z.string().max(5000).optional(),
  next_action: z.string().max(500).nullable().optional(),
  next_action_at: z.string().max(40).nullable().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { data: lead, error } = await supabase
      .from('influencer_leads')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return NextResponse.json({ lead })
  } catch {
    return NextResponse.json({ error: 'Failed to load application' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: current } = await supabase
      .from('influencer_leads')
      .select('status, first_contacted_at')
      .eq('id', id)
      .single()

    const updates: Record<string, unknown> = {}
    const { status, admin_notes, next_action, next_action_at } = parsed.data
    if (status) updates.status = status
    if (admin_notes !== undefined) updates.admin_notes = admin_notes
    if (next_action !== undefined) updates.next_action = next_action
    if (next_action_at !== undefined) updates.next_action_at = next_action_at

    if (status && status !== 'new' && current && !current.first_contacted_at) {
      updates.first_contacted_at = new Date().toISOString()
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const { data: lead, error } = await supabase
      .from('influencer_leads')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ lead })
  } catch {
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
  }
}
