import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { triggerMediaConvertForAsset } from '@/lib/video/mediaconvert'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/ugc/[id]/retry-processing
 *
 * Staff-triggered re-submit of a stuck video to MediaConvert. Useful when the
 * initial trigger failed (e.g. credentials weren't configured yet) or a job
 * errored. Uses the same VF-style direct trigger as the submission POST.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (staff.role === 'contractor_limited') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const admin = createAdminClient()

  const { data: assets, error } = await admin
    .from('ugc_submission_assets')
    .select('id, s3_key, asset_type')
    .eq('submission_id', id)
    .eq('asset_type', 'video')

  if (error) {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
  }
  if (!assets || assets.length === 0) {
    return NextResponse.json({ error: 'no_videos' }, { status: 404 })
  }

  const results = await Promise.all(
    assets.map((a) =>
      triggerMediaConvertForAsset({ assetId: a.id, s3Key: a.s3_key })
    )
  )

  const jobIds = results.flatMap((r) => (r.jobId ? [r.jobId] : []))
  const failures = results
    .map((r, i) =>
      r.ok ? null : { assetId: assets[i].id, reason: r.reason }
    )
    .filter(Boolean)

  return NextResponse.json({ ok: failures.length === 0, jobIds, failures })
}
