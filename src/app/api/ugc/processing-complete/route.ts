import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface OutputUrls {
  '1080p'?: string
  '720p'?: string
  original?: string
  thumb?: string
}

interface WebhookPayload {
  event: 'job_created' | 'output_ready'
  s3Key: string
  baseS3Key?: string
  jobId?: string
  outputs?: OutputUrls
}

/**
 * Resolve the original asset's `s3_key` for a given baseS3Key from the lambda.
 *
 * The lambda sends, for example:
 *   baseS3Key = "user-uploads/{userId}/ugc/uploads/processed/1761543527733-z3kh6prflj8-oliver-test"
 *
 * The asset row holds the *original* key:
 *   s3_key   = "user-uploads/{userId}/ugc/uploads/1761543527733-z3kh6prflj8-oliver-test.mov"
 *
 * So we strip the "/processed/" segment and ILIKE on `{originalDir}/{base}.%`.
 */
function resolveOriginalLikePattern(baseS3Key: string): string | null {
  const idx = baseS3Key.lastIndexOf('/processed/')
  if (idx === -1) return null
  const originalDir = baseS3Key.substring(0, idx)
  const base = baseS3Key.substring(idx + '/processed/'.length)
  if (!base) return null
  return `${originalDir}/${base}.%`
}

export async function POST(request: Request) {
  const expectedSecret = process.env.UGC_LAMBDA_WEBHOOK_SECRET
  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'webhook_not_configured' },
      { status: 500 }
    )
  }

  const provided = request.headers.get('x-untamed-webhook-secret')
  if (!provided || provided !== expectedSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: WebhookPayload
  try {
    body = (await request.json()) as WebhookPayload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.event || !body.s3Key) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (body.event === 'job_created') {
    if (!body.jobId) {
      return NextResponse.json(
        { error: 'job_id_required' },
        { status: 400 }
      )
    }
    const { error } = await admin
      .from('ugc_submission_assets')
      .update({
        mediaconvert_job_id: body.jobId,
        processing_status: 'processing',
      })
      .eq('s3_key', body.s3Key)
      .eq('asset_type', 'video')
    if (error) {
      console.error('processing-complete job_created update failed', error)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (body.event === 'output_ready') {
    if (!body.outputs || !body.baseS3Key) {
      return NextResponse.json(
        { error: 'outputs_or_base_required' },
        { status: 400 }
      )
    }

    const likePattern = resolveOriginalLikePattern(body.baseS3Key)
    if (!likePattern) {
      return NextResponse.json(
        { error: 'invalid_base_key' },
        { status: 400 }
      )
    }

    const { data: assets, error: lookupError } = await admin
      .from('ugc_submission_assets')
      .select('id, s3_key, processed_urls, processing_status, asset_type')
      .ilike('s3_key', likePattern)
      .eq('asset_type', 'video')
      .limit(1)

    if (lookupError) {
      console.error('processing-complete asset lookup failed', lookupError)
      return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
    }

    const asset = assets && assets[0]
    if (!asset) {
      console.warn(
        `processing-complete: no asset matched pattern ${likePattern}`
      )
      return NextResponse.json({ ok: true, matched: false })
    }

    const merged = {
      ...((asset.processed_urls as Record<string, string> | null) || {}),
      ...body.outputs,
    }
    const has1080 = !!merged['1080p']
    const has720 = !!merged['720p']
    const hasOriginal = !!merged.original
    const hasThumb = !!merged.thumb

    const allReady = has1080 && has720 && hasOriginal && hasThumb

    const update: Record<string, unknown> = {
      processed_urls: merged,
      processing_status: allReady ? 'ready' : 'processing',
    }

    if (allReady && merged['1080p']) {
      update.url = merged['1080p']
    }

    const { error: updateError } = await admin
      .from('ugc_submission_assets')
      .update(update)
      .eq('id', asset.id)

    if (updateError) {
      console.error('processing-complete update failed', updateError)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, matched: true, ready: allReady })
  }

  return NextResponse.json({ error: 'unknown_event' }, { status: 400 })
}
