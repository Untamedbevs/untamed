import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'

export const dynamic = 'force-dynamic'

const RESTRICTED_ROLES = new Set(['contractor_limited'])

// ---------------------------------------------------------------------------
// GET /api/admin/ugc -- list submissions with filters
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const staff = await resolveStaff()
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (RESTRICTED_ROLES.has(staff.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const contributorType = searchParams.get('contributor_type')
    const drinkSlug = searchParams.get('drink_slug')

    const admin = createAdminClient()

    let query = admin
      .from('ugc_submissions')
      .select(
        '*, loyalty_member:loyalty_members(id, email, first_name, points_balance), distributor_lead:distributor_leads(id, business_name, contact_name, email)'
      )
      .order('created_at', { ascending: status === 'pending' })
      .limit(500)

    if (status !== 'all') {
      query = query.eq('status', status)
    }
    if (contributorType) {
      query = query.eq('contributor_type', contributorType)
    }
    if (drinkSlug) {
      query = query.eq('drink_slug', drinkSlug)
    }

    const { data: submissions, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const submissionIds = (submissions || []).map((s) => s.id)
    let assetsBySubmission: Record<string, unknown[]> = {}

    if (submissionIds.length > 0) {
      const { data: assets } = await admin
        .from('ugc_submission_assets')
        .select('*')
        .in('submission_id', submissionIds)
        .order('display_order', { ascending: true })

      assetsBySubmission = (assets || []).reduce(
        (acc: Record<string, unknown[]>, a: { submission_id: string }) => {
          if (!acc[a.submission_id]) acc[a.submission_id] = []
          acc[a.submission_id].push(a)
          return acc
        },
        {}
      )
    }

    const enriched = (submissions || []).map((s) => ({
      ...s,
      assets: assetsBySubmission[s.id] || [],
    }))

    return NextResponse.json({ submissions: enriched })
  } catch (error) {
    console.error('[admin/ugc GET] Failed:', error)
    return NextResponse.json({ error: 'Failed to load submissions' }, { status: 500 })
  }
}
