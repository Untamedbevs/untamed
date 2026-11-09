/**
 * Automated flows runner (welcome, after-order, win-back, referral credit ->
 * redemption, points reminders, redemption status, birthday).
 *
 * Enrollments are created by database triggers (orders, consent, referral
 * credits, redemptions) and by the daily `email_flow_scan()`; this runner
 * sends whatever step is due. Each due enrollment is claimed before sending so
 * overlapping runs can't double-send.
 *
 * - Marketing flows need an opt-in to the step's list (same rules as blasts:
 *   21+, not paused, not sunset, not suppressed), respect quiet hours, the
 *   weekly frequency cap, the daily cap, and the marketing kill switch.
 * - Transactional flows (credit earned, redemption received/fulfilled, points
 *   balance) are account notices: no list opt-in needed, but every
 *   suppression (including unsubscribe) still stops them.
 * - A step's `exit_if` ends the enrollment instead of sending (they reordered,
 *   redeemed, or no longer have enough points).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { REWARDS } from '@/lib/loyalty/constants'
import { getSenderById } from '@/lib/crm/senders'
import { getMarketingDailyCap, getMarketingReadiness } from '@/lib/email/config'
import { getEmailSettings, isQuietHour, timezoneFor, type EmailSettings } from '@/lib/email/settings'
import { sanitizeBlocks, type EmailBlock, type MergeVars } from '@/lib/email/blocks'
import { renderForRecipient } from '@/lib/email/compose'
import { getEmailLists, getMarketingRecipients } from '@/lib/messaging/consent'
import { isSuppressed } from '@/lib/messaging/suppressions'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import { reasonForList } from '@/lib/messaging/marketing-email'
import { dayKey, raiseAlert } from '@/lib/email/alerts'

type Admin = ReturnType<typeof createAdminClient>

export interface FlowRow {
  slug: string
  name: string
  trigger: string
  trigger_config: Record<string, unknown>
  stream: 'marketing' | 'transactional'
  list_slug: string | null
  status: string
  sender_id: string
}

export interface FlowStepRow {
  id: string
  flow_slug: string
  step_order: number
  delay_hours: number
  subject: string
  preheader: string | null
  blocks: EmailBlock[]
  list_slug: string | null
  exit_if: 'ordered_since_enrollment' | 'redeemed_since_enrollment' | 'balance_below_min_reward' | null
  is_active: boolean
}

interface Enrollment {
  id: string
  flow_slug: string
  contact_id: string | null
  email: string
  context: Record<string, unknown>
  next_step_order: number | null
  enrolled_at: string
  steps_sent: number
}

const MIN_REWARD_POINTS = Math.min(...REWARDS.map((r) => r.pointsCost))
const CREDIT_REASONS: Record<string, string> = {
  referral_signup: 'A friend joined the pack through your link',
  referral_purchase: 'A friend you referred made their first purchase',
}
const TRANSACTIONAL_REASON = "You're receiving this because of activity on your Untamed loyalty account."
const BATCH = 100
const TIME_BUDGET_MS = 45_000
const CLAIM_MINUTES = 10

export interface FlowRunResult {
  sent: number
  exited: number
  completed: number
  deferred: number
  failed: number
  skippedMarketing: string | null
}

function nextActiveStep(steps: FlowStepRow[], afterOrder: number | null): FlowStepRow | null {
  return steps
    .filter((s) => s.is_active && (afterOrder === null || s.step_order > afterOrder))
    .sort((a, b) => a.step_order - b.step_order)[0] || null
}

function nextAllowed(now: Date, tz: string, s: EmailSettings): Date {
  for (let h = 1; h <= 24; h++) {
    const t = new Date(now.getTime() + h * 3_600_000)
    t.setUTCMinutes(0, 0, 0)
    if (!isQuietHour(t, tz, s.quiet_hours_start, s.quiet_hours_end)) return t
  }
  return new Date(now.getTime() + 3_600_000)
}

export async function runFlows(): Promise<FlowRunResult> {
  const startedAt = Date.now()
  const admin = createAdminClient()
  const result: FlowRunResult = { sent: 0, exited: 0, completed: 0, deferred: 0, failed: 0, skippedMarketing: null }

  const [{ data: flowRows }, { data: stepRows }, settings, lists] = await Promise.all([
    admin.from('email_flows').select('*').eq('status', 'active'),
    admin.from('email_flow_steps').select('*'),
    getEmailSettings(),
    getEmailLists(true),
  ])
  const flows = new Map(((flowRows || []) as FlowRow[]).map((f) => [f.slug, f]))
  if (flows.size === 0) return result

  const readiness = getMarketingReadiness()
  const marketingOk = readiness.ready && !settings.marketing_paused
  if (!marketingOk) result.skippedMarketing = settings.marketing_paused ? 'marketing paused' : 'marketing not configured'

  let marketingBudget = Infinity
  const dailyCap = getMarketingDailyCap()
  if (marketingOk && dailyCap !== null) {
    const dayStart = new Date()
    dayStart.setUTCHours(0, 0, 0, 0)
    const { count } = await admin
      .from('email_messages')
      .select('id', { count: 'exact', head: true })
      .eq('stream', 'marketing')
      .gte('sent_at', dayStart.toISOString())
    marketingBudget = Math.max(0, dailyCap - (count || 0))
  }

  const runnable = [...flows.values()].filter((f) => f.stream === 'transactional' || (marketingOk && marketingBudget > 0)).map((f) => f.slug)
  if (runnable.length === 0) return result

  const stepsByFlow = new Map<string, FlowStepRow[]>()
  for (const s of (stepRows || []) as FlowStepRow[]) {
    stepsByFlow.set(s.flow_slug, [...(stepsByFlow.get(s.flow_slug) || []), { ...s, blocks: sanitizeBlocks(s.blocks) }])
  }
  const listNames = new Map(lists.map((l) => [l.slug, l.name]))

  const { data: due } = await admin
    .from('email_flow_enrollments')
    .select('id, flow_slug, contact_id, email, context, next_step_order, enrolled_at, steps_sent')
    .eq('status', 'active')
    .in('flow_slug', runnable)
    .lte('next_run_at', new Date().toISOString())
    .order('next_run_at', { ascending: true })
    .limit(BATCH)

  for (const enrollment of (due || []) as Enrollment[]) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break
    const flow = flows.get(enrollment.flow_slug)!
    if (flow.stream === 'marketing' && marketingBudget <= 0) continue

    // Claim: push next_run_at forward only if it's still due.
    const claimUntil = new Date(Date.now() + CLAIM_MINUTES * 60_000).toISOString()
    const { data: claimed } = await admin
      .from('email_flow_enrollments')
      .update({ next_run_at: claimUntil })
      .eq('id', enrollment.id)
      .eq('status', 'active')
      .lte('next_run_at', new Date().toISOString())
      .select('id')
    if (!claimed || claimed.length === 0) continue

    try {
      const outcome = await processEnrollment(admin, flow, stepsByFlow.get(flow.slug) || [], enrollment, settings, listNames)
      if (outcome === 'sent') {
        result.sent++
        if (flow.stream === 'marketing') marketingBudget--
      } else if (outcome === 'exited') result.exited++
      else if (outcome === 'completed') result.completed++
      else if (outcome === 'deferred') result.deferred++
    } catch (err) {
      result.failed++
      console.error(`[flows] ${flow.slug} enrollment ${enrollment.id} failed:`, err instanceof Error ? err.message : err)
      // Retry in an hour.
      await admin
        .from('email_flow_enrollments')
        .update({ next_run_at: new Date(Date.now() + 3_600_000).toISOString() })
        .eq('id', enrollment.id)
    }
  }

  if (result.failed >= 3) {
    await raiseAlert({
      kind: 'flow_failure',
      severity: 'warning',
      message: `${result.failed} automated flow emails failed in one run.`,
      details: { ...result },
      dedupeKey: dayKey('flow_failure'),
    })
  }
  return result
}

async function finish(admin: Admin, id: string, status: 'exited' | 'completed' | 'cancelled', reason: string | null) {
  await admin
    .from('email_flow_enrollments')
    .update({ status, exit_reason: reason, next_run_at: null, completed_at: new Date().toISOString() })
    .eq('id', id)
}

async function processEnrollment(
  admin: Admin,
  flow: FlowRow,
  steps: FlowStepRow[],
  e: Enrollment,
  settings: EmailSettings,
  listNames: Map<string, string>
): Promise<'sent' | 'exited' | 'completed' | 'deferred'> {
  const step =
    steps.find((s) => s.is_active && s.step_order === e.next_step_order) ||
    nextActiveStep(steps, e.next_step_order === null ? null : e.next_step_order - 1)
  if (!step) {
    await finish(admin, e.id, 'completed', null)
    return 'completed'
  }

  const email = e.email.toLowerCase()
  const { data: contact } = await admin
    .from('email_contacts')
    .select('id, first_name, last_name, timezone, state_code, loyalty_member_id')
    .eq('email', email)
    .maybeSingle()
  const memberId = (e.context.member_id as string | undefined) || contact?.loyalty_member_id || null
  let balance: number | null = null
  if (memberId) {
    const { data: member } = await admin.from('loyalty_members').select('points_balance').eq('id', memberId).maybeSingle()
    balance = member?.points_balance ?? null
  }

  // Redemption notices: the redemption must still exist in the right state.
  const redemptionId = e.context.redemption_id as string | undefined
  if (redemptionId) {
    const { data: redemption } = await admin.from('loyalty_redemptions').select('status').eq('id', redemptionId).maybeSingle()
    const wanted = flow.trigger === 'redemption_fulfilled' ? ['fulfilled'] : ['pending', 'fulfilled']
    if (!redemption || !wanted.includes(String(redemption.status))) {
      await finish(admin, e.id, 'cancelled', 'redemption no longer applies')
      return 'exited'
    }
  }

  // Exit conditions.
  if (step.exit_if === 'ordered_since_enrollment') {
    const { count } = await admin
      .from('loyalty_orders')
      .select('id', { count: 'exact', head: true })
      .ilike('email', email)
      .gt('created_at', e.enrolled_at)
    if ((count || 0) > 0) {
      await finish(admin, e.id, 'exited', 'ordered again')
      return 'exited'
    }
  } else if (step.exit_if === 'redeemed_since_enrollment' && memberId) {
    const { count } = await admin
      .from('loyalty_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .neq('status', 'cancelled')
      .gt('created_at', e.enrolled_at)
    if ((count || 0) > 0) {
      await finish(admin, e.id, 'exited', 'redeemed')
      return 'exited'
    }
  } else if (step.exit_if === 'balance_below_min_reward' && (balance ?? 0) < MIN_REWARD_POINTS) {
    await finish(admin, e.id, 'exited', 'balance below the cheapest reward')
    return 'exited'
  }
  if (step.exit_if === 'redeemed_since_enrollment' && (balance ?? 0) < MIN_REWARD_POINTS) {
    await finish(admin, e.id, 'exited', 'balance below the cheapest reward')
    return 'exited'
  }

  // Suppressions stop every flow, transactional included.
  if (await isSuppressed(email)) {
    await finish(admin, e.id, 'exited', 'suppressed')
    return 'exited'
  }

  const now = new Date()
  const listSlug = step.list_slug || flow.list_slug
  if (flow.stream === 'marketing') {
    if (!listSlug) {
      await finish(admin, e.id, 'exited', 'no consent list configured')
      return 'exited'
    }
    const eligible = await getMarketingRecipients(listSlug, [email], {
      days: settings.sunset_days,
      minSends: settings.sunset_min_sends,
    })
    if (eligible.length === 0) {
      await finish(admin, e.id, 'exited', `not opted in to ${listNames.get(listSlug) || listSlug}, or not mailable`)
      return 'exited'
    }
    const { data: week } = await admin.rpc('email_recent_marketing_counts', {
      p_emails: [email],
      p_since: new Date(now.getTime() - 7 * 86_400_000).toISOString(),
    })
    const sentThisWeek = ((week || []) as { sent: number }[])[0]?.sent || 0
    if (sentThisWeek >= settings.weekly_frequency_cap) {
      await admin.from('email_flow_enrollments').update({ next_run_at: new Date(now.getTime() + 86_400_000).toISOString() }).eq('id', e.id)
      return 'deferred'
    }
    const tz = timezoneFor(contact || {}, settings.default_timezone)
    if (isQuietHour(now, tz, settings.quiet_hours_start, settings.quiet_hours_end)) {
      await admin.from('email_flow_enrollments').update({ next_run_at: nextAllowed(now, tz, settings).toISOString() }).eq('id', e.id)
      return 'deferred'
    }
  }

  const ctx = e.context
  const vars: MergeVars = {
    points: typeof ctx.points === 'number' ? ctx.points : undefined,
    credit_reason: CREDIT_REASONS[String(ctx.reason)] || (ctx.description as string) || undefined,
    reward: (ctx.reward as string) || undefined,
    points_cost: typeof ctx.points_cost === 'number' ? ctx.points_cost : undefined,
    order_items: Array.isArray(ctx.items) ? (ctx.items as string[]) : undefined,
    birthday: (ctx.birthday as string) || undefined,
  }
  const rendered = renderForRecipient({
    recipient: { email, first_name: contact?.first_name, last_name: contact?.last_name, points_balance: balance },
    subject: step.subject,
    preheader: step.preheader,
    blocks: step.blocks,
    vars,
    reason: flow.stream === 'marketing' ? reasonForList(listNames.get(listSlug!) || 'Untamed') : TRANSACTIONAL_REASON,
    kind: flow.stream,
    utmCampaign: `flow-${flow.slug}`,
  })

  const senderEmail = getSenderById(flow.sender_id).email
  await sendAndLogEmail({
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    from: senderEmail,
    replyTo: senderEmail,
    headers: rendered.headers,
    stream: flow.stream,
    tags: { flow: flow.slug },
    templateSlug: `flow:${flow.slug}`,
    flowSlug: flow.slug,
    flowStepId: step.id,
    flowEnrollmentId: e.id,
    contactId: contact?.id,
    loyaltyMemberId: memberId || undefined,
  })

  const following = nextActiveStep(steps, step.step_order)
  if (following) {
    await admin
      .from('email_flow_enrollments')
      .update({
        next_step_order: following.step_order,
        next_run_at: new Date(Date.now() + following.delay_hours * 3_600_000).toISOString(),
        steps_sent: e.steps_sent + 1,
      })
      .eq('id', e.id)
  } else {
    await admin
      .from('email_flow_enrollments')
      .update({ status: 'completed', next_run_at: null, steps_sent: e.steps_sent + 1, completed_at: new Date().toISOString() })
      .eq('id', e.id)
  }
  return 'sent'
}

/** Human description of what starts a flow, for the dashboard. */
export function describeTrigger(flow: Pick<FlowRow, 'trigger' | 'trigger_config'>): string {
  const c = flow.trigger_config || {}
  switch (flow.trigger) {
    case 'list_opt_in':
      return 'First opt-in to a consumer list'
    case 'order_placed':
      return 'Every online order (from AccelPay)'
    case 'order_lapsed':
      return `No order for ${Number(c.days) || 60} days`
    case 'points_balance':
      return `Balance of ${(Number(c.min_points) || 5000).toLocaleString()}+ points and no redemption in ${Number(c.every_days) || 30} days`
    case 'referral_credit':
      return 'Referral points credited (friend joined or first purchase)'
    case 'redemption_created':
      return 'A reward redemption is placed'
    case 'redemption_fulfilled':
      return 'Staff mark a redemption fulfilled'
    case 'birthday':
      return 'Birthday saved in email preferences'
    case 'cart_abandoned':
      return 'Abandoned cart'
    default:
      return flow.trigger
  }
}
