export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { planBlast, BlastPlanError, type BlastTarget } from '@/lib/crm/blast-plan'

const PREVIEW_LIMIT = 100

export async function POST(request: NextRequest) {
  try {
    const staff = await resolveStaff()
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as Partial<BlastTarget>
    const plan = await planBlast({
      kind: body.kind || 'marketing',
      listSlug: body.listSlug,
      repermissionAudience: body.repermissionAudience,
      filters: body.filters!,
    })

    return NextResponse.json({
      count: plan.recipients.length,
      matchedCount: plan.matchedCount,
      suppressedCount: plan.suppressedCount,
      // Matched by the filters but not mailable: no opt-in for this list,
      // not 21+ verified, outside allowed countries, or suppressed.
      notEligibleCount:
        plan.matchedCount === null ? null : Math.max(0, plan.matchedCount - plan.recipients.length),
      recipients: plan.recipients.slice(0, PREVIEW_LIMIT).map((r) => ({
        email: r.email,
        name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email,
      })),
    })
  } catch (error: unknown) {
    if (error instanceof BlastPlanError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error in blast preview:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
