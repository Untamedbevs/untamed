import { NextRequest, NextResponse } from 'next/server'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  UgcAssetType,
  UgcContributorType,
} from '@/lib/ugc/types'
import { triggerMediaConvertForVideoAssets } from '@/lib/video/mediaconvert'

export const dynamic = 'force-dynamic'

const ALLOWED_DRINK_SLUGS = new Set([
  'black-panther',
  'cheetah',
  'cougar',
  'lioness',
])

interface IncomingAsset {
  s3Key: string
  url: string
  assetType: UgcAssetType
  mimeType?: string
  width?: number
  height?: number
  durationSeconds?: number
  fileSizeBytes?: number
  displayOrder?: number
}

interface CreateBody {
  caption?: string
  drinkSlug?: string
  tags?: string[]
  location?: string
  consentGranted: boolean
  consentSignature: string
  isPublic?: boolean
  assets: IncomingAsset[]
}

// ---------------------------------------------------------------------------
// GET /api/portal/ugc -- list caller's own submissions
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const member = await resolveMember()
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: submissions, error } = await admin
      .from('ugc_submissions')
      .select('*')
      .eq('auth_user_id', member.authUserId)
      .order('created_at', { ascending: false })
      .limit(200)

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
    console.error('[portal/ugc GET] Failed:', error)
    return NextResponse.json({ error: 'Failed to load submissions' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/portal/ugc -- create a new submission with N assets
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const member = await resolveMember()
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as CreateBody

    if (!body.consentGranted) {
      return NextResponse.json(
        { error: 'Consent is required to submit UGC.' },
        { status: 400 }
      )
    }
    if (!body.consentSignature?.trim()) {
      return NextResponse.json(
        { error: 'Please type your name as signature.' },
        { status: 400 }
      )
    }
    if (!Array.isArray(body.assets) || body.assets.length === 0) {
      return NextResponse.json(
        { error: 'At least one photo or video is required.' },
        { status: 400 }
      )
    }
    if (body.assets.length > 10) {
      return NextResponse.json(
        { error: 'You can submit at most 10 files at a time.' },
        { status: 400 }
      )
    }

    const drinkSlug = body.drinkSlug?.trim() || null
    if (drinkSlug && !ALLOWED_DRINK_SLUGS.has(drinkSlug)) {
      return NextResponse.json({ error: 'Invalid drink' }, { status: 400 })
    }

    const ownsAllAssets = body.assets.every((a) =>
      a.s3Key.startsWith(`user-uploads/${member.authUserId}/`)
    )
    if (!ownsAllAssets) {
      return NextResponse.json(
        { error: 'One or more files do not belong to your account.' },
        { status: 403 }
      )
    }

    let contributorType: UgcContributorType = 'loyalty'
    let loyaltyMemberId: string | null = null
    let distributorLeadId: string | null = null
    let contributorDisplayName: string | null = null

    if (member.loyaltyMember) {
      contributorType = 'loyalty'
      loyaltyMemberId = member.loyaltyMember.id
      contributorDisplayName = member.loyaltyMember.first_name
    } else if (member.distributorLeads.length > 0) {
      contributorType = 'distributor'
      distributorLeadId = member.distributorLeads[0].id
      contributorDisplayName =
        member.distributorLeads[0].contact_name ||
        member.distributorLeads[0].business_name
    } else {
      return NextResponse.json(
        {
          error:
            'You need to be a loyalty member or distributor lead to submit. Join the loyalty program first.',
        },
        { status: 403 }
      )
    }

    const admin = createAdminClient()
    const now = new Date().toISOString()

    const { data: submission, error: submissionError } = await admin
      .from('ugc_submissions')
      .insert({
        auth_user_id: member.authUserId,
        contributor_type: contributorType,
        loyalty_member_id: loyaltyMemberId,
        distributor_lead_id: distributorLeadId,
        contributor_email: member.email,
        contributor_display_name: contributorDisplayName,
        caption: body.caption?.trim() || null,
        drink_slug: drinkSlug,
        tags: Array.isArray(body.tags)
          ? body.tags.map((t) => t.trim()).filter(Boolean).slice(0, 20)
          : [],
        location: body.location?.trim() || null,
        consent_granted: true,
        consent_signature: body.consentSignature.trim(),
        consent_at: now,
        status: 'pending',
        is_public: body.isPublic !== false,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()

    if (submissionError || !submission) {
      console.error('[portal/ugc] Insert submission failed:', submissionError)
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
    }

    const assetRows = body.assets.map((a, i) => ({
      submission_id: submission.id,
      asset_type: a.assetType,
      s3_key: a.s3Key,
      url: a.url,
      mime_type: a.mimeType || null,
      processing_status: a.assetType === 'video' ? 'uploaded' : 'ready',
      width: a.width ?? null,
      height: a.height ?? null,
      duration_seconds: a.durationSeconds ?? null,
      file_size_bytes: a.fileSizeBytes ?? null,
      display_order: a.displayOrder ?? i,
    }))

    const { data: assets, error: assetError } = await admin
      .from('ugc_submission_assets')
      .insert(assetRows)
      .select('*')

    if (assetError) {
      console.error('[portal/ugc] Insert assets failed:', assetError)
      await admin.from('ugc_submissions').delete().eq('id', submission.id)
      return NextResponse.json({ error: 'Failed to save assets' }, { status: 500 })
    }

    // Fire MediaConvert transcoding jobs for any video assets. This mirrors
    // the VibrationFit flow: file lands in S3 via presigned upload, then the
    // app submits the MediaConvert job directly from this route. We update
    // the asset rows with mediaconvert_job_id + processing_status='processing'
    // inside the helper so the admin UI reflects state immediately.
    const videoAssets = (assets || []).filter(
      (a): a is { id: string; s3_key: string; asset_type: string } =>
        a?.asset_type === 'video' && typeof a?.s3_key === 'string'
    )
    if (videoAssets.length > 0) {
      try {
        const results = await triggerMediaConvertForVideoAssets(videoAssets)
        const submitted = results.filter((r) => r.ok).length
        console.log(
          `[portal/ugc] MediaConvert: ${submitted}/${videoAssets.length} jobs submitted`,
          results.filter((r) => !r.ok).map((r) => r.reason)
        )
      } catch (err) {
        // Never break the user-facing submission flow because of a transcoding
        // failure -- staff can re-trigger from /admin/ugc/[id].
        console.error('[portal/ugc] MediaConvert trigger threw', err)
      }
    }

    return NextResponse.json({
      submission: { ...submission, assets: assets || [] },
    })
  } catch (error) {
    console.error('[portal/ugc POST] Failed:', error)
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 })
  }
}
