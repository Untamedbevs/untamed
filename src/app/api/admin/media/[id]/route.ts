import { createAdminClient } from '@/lib/supabase/admin'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('media')
    .select('*, uploaded_by_staff:staff!media_uploaded_by_fkey(full_name)')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('media')
    .update({
      ...(body.alt_text !== undefined && { alt_text: body.alt_text }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.folder !== undefined && { folder: body.folder }),
      ...(body.filename !== undefined && { filename: body.filename }),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: media } = await supabase
    .from('media')
    .select('s3_key')
    .eq('id', id)
    .single()

  if (media?.s3_key) {
    try {
      const s3 = getS3Client()
      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: media.s3_key,
        })
      )
    } catch (e) {
      console.error('S3 delete failed:', e)
    }
  }

  const { error } = await supabase.from('media').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
