import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { LEAD_STATUS_LABELS } from '@/lib/referral/constants'
import type { DistributorLeadStatus } from '@/lib/referral/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const supabase = createAdminClient()
    const [{ data: lead, error }, { data: activities }] = await Promise.all([
      supabase
        .from('distributor_leads')
        .select('*, referrer:referral_participants(email, display_name, referral_code)')
        .eq('id', id)
        .single(),
      supabase
        .from('lead_activities')
        .select('*, staff:staff_id(full_name, email)')
        .eq('lead_id', id)
        .order('created_at', { ascending: false }),
    ])
    if (error) throw error
    return NextResponse.json({ lead, activities: activities || [] })
  } catch {
    return NextResponse.json({ error: 'Failed to load lead' }, { status: 500 })
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
    const body = await request.json()
    const { status, admin_notes, next_action, next_action_at } = body as {
      status?: DistributorLeadStatus
      admin_notes?: string
      next_action?: string | null
      next_action_at?: string | null
    }

    const supabase = createAdminClient()
    const { data: current } = await supabase
      .from('distributor_leads')
      .select('status, first_contacted_at')
      .eq('id', id)
      .single()

    const updates: Record<string, unknown> = {}
    if (status) updates.status = status
    if (admin_notes !== undefined) updates.admin_notes = admin_notes
    if (next_action !== undefined) updates.next_action = next_action
    if (next_action_at !== undefined) updates.next_action_at = next_action_at

    if (
      status &&
      status !== 'new' &&
      current &&
      !current.first_contacted_at
    ) {
      updates.first_contacted_at = new Date().toISOString()
    }

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

    if (status && current && status !== current.status) {
      await supabase.from('lead_activities').insert({
        lead_id: id,
        staff_id: staff.id,
        activity_type: 'status_change',
        body: `${LEAD_STATUS_LABELS[current.status] || current.status} → ${LEAD_STATUS_LABELS[status] || status}`,
        metadata: { from: current.status, to: status },
      })
    }

    if (next_action !== undefined) {
      await supabase.from('lead_activities').insert({
        lead_id: id,
        staff_id: staff.id,
        activity_type: 'next_action',
        body: next_action || 'Cleared next action',
        metadata: { next_action_at: next_action_at || null },
      })
    }

    return NextResponse.json({ lead })
  } catch {
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}
