import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { memberId, filename, contentType, drinkSlug } = await request.json()

    if (!memberId || !filename || !contentType) {
      return NextResponse.json(
        { error: 'memberId, filename, and contentType are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: member } = await supabase
      .from('loyalty_members')
      .select('id')
      .eq('id', memberId)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })

    const timestamp = Date.now()
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const s3Key = `loyalty/receipts/${memberId}/${timestamp}-${safeName}`

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
      ContentType: contentType,
      CacheControl: 'private, max-age=31536000',
    })

    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 600 })

    const cdnBase = process.env.MEDIA_CDN_URL
    const bucket = process.env.AWS_S3_BUCKET!
    const publicUrl = cdnBase
      ? `${cdnBase.replace(/\/$/, '')}/${s3Key}`
      : `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`

    const { data: receipt, error } = await supabase
      .from('loyalty_receipts')
      .insert({
        member_id: memberId,
        image_url: publicUrl,
        drink_slug: drinkSlug || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      presignedUrl,
      s3Key,
      publicUrl,
      receipt,
    })
  } catch {
    return NextResponse.json({ error: 'Receipt upload failed' }, { status: 500 })
  }
}
