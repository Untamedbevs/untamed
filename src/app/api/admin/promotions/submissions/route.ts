import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMemberDataStaff } from '@/lib/auth/resolve-staff'
import { SUBMISSION_COLUMNS, type SubmissionStatus } from '@/lib/rewards/catalog'
import { s3PublicUrl } from '@/lib/storage/s3'

export const dynamic = 'force-dynamic'

const STATUSES: SubmissionStatus[] = ['pending', 'approved', 'rejected']

/**
 * GET /api/admin/promotions/submissions?status=pending|approved|rejected|all
 * The Hunt review queue: pending oldest first, everything else newest first.
 */
export async function GET(request: NextRequest) {
  const staff = await resolveMemberDataStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = request.nextUrl.searchParams.get('status') || 'pending'
  if (status !== 'all' && !STATUSES.includes(status as SubmissionStatus)) {
    return NextResponse.json({ error: 'status must be pending, approved, rejected or all' }, { status: 400 })
  }

  let query = createAdminClient()
    .from('promotion_submissions')
    .select(
      `${SUBMISSION_COLUMNS}, promotion:promotions(title, points, review_checklist, requirements, icon, url_label), member:loyalty_members(email, first_name, points_balance), reviewer:staff(full_name)`
    )
    .order('created_at', { ascending: status === 'pending' })
    .limit(200)
  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('[admin/promotions/submissions GET] Failed:', error)
    return NextResponse.json({ error: 'Failed to load submissions' }, { status: 500 })
  }

  return NextResponse.json({
    submissions: (data || []).map((s) => ({
      ...s,
      proof_image_url: s.proof_image_key ? s3PublicUrl(s.proof_image_key) : null,
    })),
  })
}
