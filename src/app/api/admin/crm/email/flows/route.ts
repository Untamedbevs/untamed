export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { describeTrigger, type FlowRow } from '@/lib/email/flows'

interface StatRow {
  flow_slug: string | null
  sent: number
  delivered: number
  clicked: number
  unsubscribes: number
  orders: number
  revenue_cents: number
}

/** All flows with 30-day performance and enrollment counts. */
export async function GET() {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [{ data: flows, error }, { data: steps }, { data: stats }, { data: enrollments }] = await Promise.all([
    admin.from('email_flows').select('*').order('sort_order'),
    admin.from('email_flow_steps').select('flow_slug, is_active'),
    admin.rpc('email_send_stats', { p_since: since }),
    admin.from('email_flow_enrollments').select('flow_slug, status').gte('updated_at', since).limit(50_000),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const statsBySlug = new Map(((stats || []) as StatRow[]).filter((s) => s.flow_slug).map((s) => [s.flow_slug!, s]))
  const counts = new Map<string, Record<string, number>>()
  for (const e of enrollments || []) {
    const c = counts.get(e.flow_slug) || {}
    c[e.status] = (c[e.status] || 0) + 1
    counts.set(e.flow_slug, c)
  }

  return NextResponse.json({
    flows: ((flows || []) as (FlowRow & { description: string | null; sort_order: number })[]).map((f) => ({
      ...f,
      triggerDescription: describeTrigger(f),
      stepCount: (steps || []).filter((s) => s.flow_slug === f.slug && s.is_active).length,
      enrollments: counts.get(f.slug) || {},
      stats30d: statsBySlug.get(f.slug) || null,
    })),
  })
}
