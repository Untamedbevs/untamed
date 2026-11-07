import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { POINTS } from '@/lib/loyalty/constants'
import type { UgcStatus, UgcSubmissionAsset } from '@/lib/ugc/types'

export const dynamic = 'force-dynamic'

const RESTRICTED_ROLES = new Set(['contractor_limited'])

interface ReviewBody {
  action: 'approve' | 'reject' | 'feature' | 'unfeature' | 'set_public'
  rejectionReason?: string
  customPoints?: number
  promoteToLibrary?: boolean
  isPublic?: boolean
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const staff = await resolveStaff()
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (RESTRICTED_ROLES.has(staff.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: submission, error } = await admin
    .from('ugc_submissions')
    .select(
      '*, loyalty_member:loyalty_members(id, email, first_name, points_balance), distributor_lead:distributor_leads(id, business_name, contact_name, email)'
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!submission) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: assets } = await admin
    .from('ugc_submission_assets')
    .select('*')
    .eq('submission_id', id)
    .order('display_order', { ascending: true })

  return NextResponse.json({
    submission: { ...submission, assets: assets || [] },
  })
}

// ---------------------------------------------------------------------------
// PUT /api/admin/ugc/[id] -- approve / reject / feature / promote-to-library
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const staff = await resolveStaff()
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (RESTRICTED_ROLES.has(staff.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json()) as ReviewBody
    if (!body.action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: submission } = await admin
      .from('ugc_submissions')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!submission) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (body.action === 'set_public') {
      await admin
        .from('ugc_submissions')
        .update({
          is_public: !!body.isPublic,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      return NextResponse.json({ ok: true })
    }

    const now = new Date().toISOString()

    if (body.action === 'reject') {
      if (!body.rejectionReason?.trim()) {
        return NextResponse.json(
          { error: 'rejectionReason is required to reject' },
          { status: 400 }
        )
      }
      await admin
        .from('ugc_submissions')
        .update({
          status: 'rejected' as UgcStatus,
          rejection_reason: body.rejectionReason.trim(),
          reviewed_by: staff.id,
          reviewed_at: now,
          updated_at: now,
        })
        .eq('id', id)
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'unfeature') {
      if (submission.status !== 'featured') {
        return NextResponse.json(
          { error: 'Submission is not featured' },
          { status: 400 }
        )
      }
      await admin
        .from('ugc_submissions')
        .update({
          status: 'approved' as UgcStatus,
          updated_at: now,
        })
        .eq('id', id)
      return NextResponse.json({ ok: true })
    }

    // approve / feature
    const targetStatus: UgcStatus =
      body.action === 'feature' ? 'featured' : 'approved'

    // Points accumulate toward a target total (approved vs featured), so
    // featuring an already-approved submission credits the remaining delta
    // and the contributor always ends up at the full featured amount.
    const targetTotal =
      targetStatus === 'featured'
        ? POINTS.PER_UGC_FEATURED
        : POINTS.PER_UGC_APPROVED

    if (
      body.customPoints !== undefined &&
      body.customPoints !== null &&
      !(Number.isInteger(body.customPoints) && body.customPoints >= 0)
    ) {
      return NextResponse.json(
        { error: 'customPoints must be a whole number, 0 or more' },
        { status: 400 }
      )
    }

    const pointsToAward =
      typeof body.customPoints === 'number'
        ? body.customPoints
        : Math.max(0, targetTotal - (submission.points_awarded || 0))

    // One locked call writes the status, the submission's points and the
    // member's points together, and only if points_awarded is still what we
    // read above, so two reviews at once can't both credit the member.
    const { data: reviewed, error: reviewErr } = await admin.rpc('loyalty_review_ugc', {
      p_submission_id: id,
      p_status: targetStatus,
      p_points: pointsToAward,
      p_expected_points: submission.points_awarded ?? 0,
      p_description:
        targetStatus === 'featured'
          ? `UGC featured (+${pointsToAward} pts)`
          : `UGC approved (+${pointsToAward} pts)`,
      p_staff_id: staff.id,
    })
    if (reviewErr) {
      console.error('[admin/ugc PUT] Review failed:', reviewErr)
      return NextResponse.json({ error: 'Review failed' }, { status: 500 })
    }
    const row = (Array.isArray(reviewed) ? reviewed[0] : reviewed) as
      | { result: string; awarded: number }
      | undefined
    if (row?.result === 'changed') {
      return NextResponse.json(
        { error: 'This submission was just reviewed by someone else. Refresh and try again.' },
        { status: 409 }
      )
    }
    if (row?.result !== targetStatus) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (body.promoteToLibrary) {
      const { data: assets } = await admin
        .from('ugc_submission_assets')
        .select('*')
        .eq('submission_id', id)
        .order('display_order', { ascending: true })

      const assetList = (assets || []) as UgcSubmissionAsset[]
      const promotedIds: string[] = [...(submission.promoted_media_ids || [])]
      const tags = [
        'ugc',
        submission.contributor_type,
        ...(submission.drink_slug ? [submission.drink_slug] : []),
        ...(submission.tags || []),
      ]

      for (const asset of assetList) {
        const fileType = asset.asset_type
        const url =
          asset.processed_urls?.['1080p'] ||
          asset.processed_urls?.['720p'] ||
          asset.url
        const filename = asset.s3_key.split('/').pop() || `ugc-${asset.id}`

        const { data: media, error: mediaError } = await admin
          .from('media')
          .insert({
            filename,
            s3_key: asset.s3_key,
            url,
            file_type: fileType,
            mime_type: asset.mime_type,
            file_size: asset.file_size_bytes,
            width: asset.width,
            height: asset.height,
            tags,
            folder: '/ugc',
            uploaded_by: staff.id,
          })
          .select('id')
          .single()

        if (!mediaError && media) {
          promotedIds.push(media.id)
        } else if (mediaError) {
          console.warn(
            `[admin/ugc PUT] Failed to promote asset ${asset.id}:`,
            mediaError.message
          )
        }
      }

      await admin
        .from('ugc_submissions')
        .update({
          promoted_media_ids: promotedIds,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
    }

    return NextResponse.json({
      ok: true,
      pointsAwarded: pointsToAward,
      status: targetStatus,
    })
  } catch (error) {
    console.error('[admin/ugc PUT] Failed:', error)
    return NextResponse.json({ error: 'Review failed' }, { status: 500 })
  }
}
