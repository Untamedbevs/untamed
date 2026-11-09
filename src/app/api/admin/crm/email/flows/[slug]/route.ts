export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff, canSendMarketing, canViewContacts } from '@/lib/auth/resolve-staff'
import { describeTrigger, type FlowRow, type FlowStepRow } from '@/lib/email/flows'
import { checkEmailContent } from '@/lib/email/checks'
import { sanitizeBlocks } from '@/lib/email/blocks'
import { CRM_SENDERS } from '@/lib/crm/senders'
import { isUuid } from '@/lib/messaging/consent'
import { logStaffAction } from '@/lib/audit'

async function loadFlow(slug: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('email_flows').select('*').eq('slug', slug).maybeSingle()
  return data as (FlowRow & { description: string | null }) | null
}

/** One flow: settings, steps, recent enrollments. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { slug } = await params
  const flow = await loadFlow(slug)
  if (!flow) return NextResponse.json({ error: 'Flow not found' }, { status: 404 })

  const admin = createAdminClient()
  const [{ data: steps }, { data: enrollments }, { data: lists }] = await Promise.all([
    admin.from('email_flow_steps').select('*').eq('flow_slug', slug).order('step_order'),
    canViewContacts(staff.role)
      ? admin
          .from('email_flow_enrollments')
          .select('id, email, status, next_step_order, next_run_at, steps_sent, exit_reason, enrolled_at, completed_at')
          .eq('flow_slug', slug)
          .order('enrolled_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    admin.from('email_lists').select('slug, name, requires_age_verification').eq('is_active', true).order('sort_order'),
  ])

  return NextResponse.json({
    flow: { ...flow, triggerDescription: describeTrigger(flow) },
    steps: steps || [],
    enrollments: enrollments || [],
    lists: lists || [],
    senders: CRM_SENDERS.map((s) => ({ id: s.id, label: s.label, email: s.email })),
    canActivate: canSendMarketing(staff.role),
  })
}

/**
 * Update flow settings. Body: { status?, trigger_config?, list_slug?, sender_id? }
 * Activating requires an admin and steps whose content passes checks.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canSendMarketing(staff.role)) return NextResponse.json({ error: 'Only admins can change flows.' }, { status: 403 })
  const { slug } = await params
  const flow = await loadFlow(slug)
  if (!flow) return NextResponse.json({ error: 'Flow not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_by: staff.id }

  if (body.status !== undefined) {
    if (!['draft', 'active', 'paused'].includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    if (flow.status === 'unavailable') return NextResponse.json({ error: 'This flow isn’t available yet.' }, { status: 409 })
    if (body.status === 'active') {
      const admin = createAdminClient()
      const { data: steps } = await admin.from('email_flow_steps').select('*').eq('flow_slug', slug).eq('is_active', true)
      if (!steps || steps.length === 0) return NextResponse.json({ error: 'Add at least one active step first.' }, { status: 400 })
      const problems = (steps as FlowStepRow[]).flatMap((s) =>
        checkEmailContent({ subject: s.subject, preheader: s.preheader, blocks: sanitizeBlocks(s.blocks), kind: flow.stream }).errors.map(
          (e) => `Step ${s.step_order}: ${e}`
        )
      )
      if (problems.length) return NextResponse.json({ error: 'Fix the content checks first.', issues: problems }, { status: 400 })
    }
    patch.status = body.status
  }
  if (body.trigger_config && typeof body.trigger_config === 'object') {
    const config: Record<string, number> = {}
    for (const key of ['days', 'min_points', 'every_days']) {
      const n = Number(body.trigger_config[key])
      if (Number.isFinite(n) && n > 0) config[key] = Math.round(n)
    }
    patch.trigger_config = { ...flow.trigger_config, ...config }
  }
  if (body.list_slug !== undefined && flow.stream === 'marketing') {
    if (typeof body.list_slug !== 'string' || !body.list_slug) return NextResponse.json({ error: 'Marketing flows need a list' }, { status: 400 })
    patch.list_slug = body.list_slug
  }
  if (typeof body.sender_id === 'string' && CRM_SENDERS.some((s) => s.id === body.sender_id)) patch.sender_id = body.sender_id

  const admin = createAdminClient()
  const { data, error } = await admin.from('email_flows').update(patch).eq('slug', slug).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logStaffAction(staff.id, body.status ? `flow.${body.status}` : 'flow.update', 'email_flow', slug, patch)
  return NextResponse.json({ flow: data })
}

/** Stop one enrollment. Body: { action: 'cancel_enrollment', enrollmentId } */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewContacts(staff.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { slug } = await params
  const body = await request.json().catch(() => ({}))
  if (body.action !== 'cancel_enrollment' || !isUuid(body.enrollmentId)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('email_flow_enrollments')
    .update({ status: 'cancelled', exit_reason: 'Stopped by staff', next_run_at: null, completed_at: new Date().toISOString() })
    .eq('id', body.enrollmentId)
    .eq('flow_slug', slug)
    .eq('status', 'active')
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Enrollment not active' }, { status: 409 })

  await logStaffAction(staff.id, 'flow.cancel_enrollment', 'email_flow_enrollment', body.enrollmentId, { flow: slug })
  return NextResponse.json({ ok: true })
}
