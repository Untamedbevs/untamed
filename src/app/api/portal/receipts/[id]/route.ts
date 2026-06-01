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
  if (!member.loyaltyMember) {
    return NextResponse.json({ error: 'NOT_A_LOYALTY_MEMBER' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: receipt, error } = await admin
    .from('loyalty_receipts')
    .select('*')
    .eq('id', id)
    .eq('member_id', member.loyaltyMember.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!receipt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: assets } = await admin
    .from('loyalty_receipt_assets')
    .select('*')
    .eq('receipt_id', id)
    .order('display_order', { ascending: true })

  return NextResponse.json({
    receipt: { ...receipt, assets: assets || [] },
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
    if (!member.loyaltyMember) {
      return NextResponse.json({ error: 'NOT_A_LOYALTY_MEMBER' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: receipt } = await admin
      .from('loyalty_receipts')
      .select('id, status, member_id')
      .eq('id', id)
      .maybeSingle()

    if (!receipt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (receipt.member_id !== member.loyaltyMember.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (receipt.status !== 'pending') {
      return NextResponse.json(
        { error: 'Cannot delete after review. Contact support if needed.' },
        { status: 400 }
      )
    }

    const { data: assets } = await admin
      .from('loyalty_receipt_assets')
      .select('s3_key')
      .eq('receipt_id', id)

    const bucket = process.env.AWS_S3_BUCKET!
    const s3 = getS3Client()

    for (const asset of assets || []) {
      try {
        await s3.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: asset.s3_key })
        )
      } catch (err) {
        console.warn(
          `[portal/receipts DELETE] Failed to delete S3 object ${asset.s3_key}:`,
          err
        )
      }
    }

    // FK ON DELETE CASCADE removes asset rows automatically.
    await admin.from('loyalty_receipts').delete().eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[portal/receipts DELETE] Failed:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
