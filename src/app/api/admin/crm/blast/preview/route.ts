export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { queryRecipients, type BlastFilters } from '@/lib/crm/blast-filters'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { filterSuppressed } from '@/lib/messaging/suppressions'

const PREVIEW_LIMIT = 100

export async function POST(request: NextRequest) {
  try {
    const staff = await resolveStaff()
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const filters: BlastFilters = body.filters || body

    if (!filters.audience) {
      return NextResponse.json({ error: 'Audience is required' }, { status: 400 })
    }

    const allRecipients = await queryRecipients(filters)
    const { allowed, suppressed } = await filterSuppressed(allRecipients)

    return NextResponse.json({
      count: allowed.length,
      suppressedCount: suppressed.length,
      totalBeforeSuppression: allRecipients.length,
      recipients: allowed.slice(0, PREVIEW_LIMIT),
    })
  } catch (error: unknown) {
    console.error('Error in blast preview:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
