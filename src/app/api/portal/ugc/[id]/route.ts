import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { getS3Client } from '@/lib/storage/s3'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const member = await resolveMember()
  if (!member) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: submission, error } = await admin
    .from('ugc_submissions')
    .select('*')
    .eq('id', id)
    .eq('auth_user_id', member.authUserId)
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const member = await resolveMember()
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: submission } = await admin
      .from('ugc_submissions')
      .select('id, status, auth_user_id')
      .eq('id', id)
      .maybeSingle()

    if (!submission) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (submission.auth_user_id !== member.authUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (submission.status !== 'pending') {
      return NextResponse.json(
        { error: 'Cannot delete after review. Contact support if needed.' },
        { status: 400 }
      )
    }

    const { data: assets } = await admin
      .from('ugc_submission_assets')
      .select('s3_key')
      .eq('submission_id', id)

    const bucket = process.env.AWS_S3_BUCKET!
    const s3 = getS3Client()

    for (const asset of assets || []) {
      try {
        await s3.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: asset.s3_key })
        )
      } catch (err) {
        console.warn(
          `[portal/ugc DELETE] Failed to delete S3 object ${asset.s3_key}:`,
          err
        )
      }
    }

    await admin.from('ugc_submissions').delete().eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[portal/ugc DELETE] Failed:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
