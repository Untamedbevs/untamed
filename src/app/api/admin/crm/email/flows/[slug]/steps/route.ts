export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canDraftMarketing } from '@/lib/auth/resolve-staff'
import { sanitizeBlocks } from '@/lib/email/blocks'
import { isUuid } from '@/lib/messaging/consent'
import { logStaffAction } from '@/lib/audit'

const EXIT_IF = ['ordered_since_enrollment', 'redeemed_since_enrollment', 'balance_below_min_reward']

/**
 * Replace a flow's steps. Body: { steps: [{ id?, delay_hours, subject,
 * preheader, blocks, list_slug, exit_if, is_active }] } in send order.
 * Existing steps keep their ids (so history stays linked); removed steps are
 * deleted. Enrollments wait on a step number, so one waiting on a removed or
 * renumbered step continues with whichever step now has that number or the
 * next one after it.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canDraftMarketing(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { slug } = await params

  const body = await request.json().catch(() => ({}))
  if (!Array.isArray(body.steps) || body.steps.length > 10) {
    return NextResponse.json({ error: 'Send 1–10 steps' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: flow } = await admin.from('email_flows').select('slug, stream').eq('slug', slug).maybeSingle()
  if (!flow) return NextResponse.json({ error: 'Flow not found' }, { status: 404 })

  const { data: existing } = await admin.from('email_flow_steps').select('id').eq('flow_slug', slug)
  const existingIds = new Set((existing || []).map((s) => s.id))

  const rows = body.steps.map((s: Record<string, unknown>, i: number) => ({
    ...(isUuid(s.id) && existingIds.has(s.id) ? { id: s.id } : {}),
    flow_slug: slug,
    // Temporary orders avoid unique (flow_slug, step_order) clashes mid-update.
    step_order: 1000 + i + 1,
    delay_hours: Math.max(0, Math.min(24 * 365, Math.round(Number(s.delay_hours) || 0))),
    subject: typeof s.subject === 'string' ? s.subject.slice(0, 300) : '',
    preheader: typeof s.preheader === 'string' ? s.preheader.slice(0, 300) : null,
    blocks: sanitizeBlocks(s.blocks),
    list_slug: flow.stream === 'marketing' && typeof s.list_slug === 'string' && s.list_slug ? s.list_slug : null,
    exit_if: typeof s.exit_if === 'string' && EXIT_IF.includes(s.exit_if) ? s.exit_if : null,
    is_active: s.is_active !== false,
  }))

  const keepIds = rows.filter((r: { id?: string }) => r.id).map((r: { id: string }) => r.id)
  const removed = [...existingIds].filter((id) => !keepIds.includes(id))
  if (removed.length) {
    const { error } = await admin.from('email_flow_steps').delete().in('id', removed)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // Park kept steps on distinct high orders so the upsert can't collide.
  for (let i = 0; i < keepIds.length; i++) {
    await admin.from('email_flow_steps').update({ step_order: 2000 + i }).eq('id', keepIds[i])
  }
  const { error: upsertError } = await admin.from('email_flow_steps').upsert(rows)
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

  // Final orders 1..n.
  const { data: saved } = await admin.from('email_flow_steps').select('id, step_order').eq('flow_slug', slug).order('step_order')
  for (let i = 0; i < (saved || []).length; i++) {
    await admin.from('email_flow_steps').update({ step_order: i + 1 }).eq('id', saved![i].id)
  }

  await logStaffAction(staff.id, 'flow.steps_update', 'email_flow', slug, { steps: rows.length })
  const { data: steps } = await admin.from('email_flow_steps').select('*').eq('flow_slug', slug).order('step_order')
  return NextResponse.json({ steps: steps || [] })
}
