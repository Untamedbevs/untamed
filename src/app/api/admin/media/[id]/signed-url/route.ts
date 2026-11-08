import { createAdminClient } from '@/lib/supabase/admin'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { isLibraryKey } from '@/lib/media/library-key'

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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data: media, error } = await supabase
    .from('media')
    .select('s3_key, is_private')
    .eq('id', id)
    .single()

  if (error || !media) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 })
  }

  if (!media.is_private) {
    return NextResponse.json(
      { error: 'File is not private — use the public URL' },
      { status: 400 }
    )
  }

  // Only sign objects the media library owns (media/... or private/...).
  if (!isLibraryKey(media.s3_key)) {
    return NextResponse.json(
      { error: 'File is not a media library file' },
      { status: 400 }
    )
  }

  const s3 = getS3Client()
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: media.s3_key,
  })

  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 })

  return NextResponse.json({ url: signedUrl })
}
