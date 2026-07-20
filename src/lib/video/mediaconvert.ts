/**
 * MediaConvert trigger helper -- VibrationFit-style pattern.
 *
 * Files land in S3 first (via presigned PUT / multipart). Then the application
 * directly submits a MediaConvert job to transcode + thumbnail the file. No
 * Lambda, no S3 event triggers, no extra IAM roles for the deploy user beyond
 * MediaConvert access + iam:PassRole on the MediaConvertRole.
 *
 * Output naming convention (matches `getVideoThumbnailUrl` in
 * `src/lib/media/video-urls.ts` and the UgcVideo player):
 *
 *   {base}-1080p.mp4
 *   {base}-720p.mp4
 *   {base}-original.mp4
 *   {base}-thumb.0000000.jpg
 *
 * Outputs land in the same S3 prefix under a `processed/` subfolder.
 */

import {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand,
} from '@aws-sdk/client-mediaconvert'
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { getS3Client, s3PublicUrl } from '@/lib/storage/s3'
import { createAdminClient } from '@/lib/supabase/admin'

export interface TriggerInput {
  /** ugc_submission_assets.id -- needed to write back job_id + processing_status */
  assetId: string
  /** Full S3 object key for the source file */
  s3Key: string
}

export interface TriggerResult {
  ok: boolean
  jobId?: string
  reason?: string
}

const VIDEO_EXT_REGEX = /\.(mp4|mov|m4v|webm|mkv|avi)$/i

/**
 * Confirm the source object actually exists in S3 before we push a job.
 * "Make sure it hits S3, THEN process." S3 is read-after-write consistent for
 * new objects, but multipart completes / proxied uploads can lag a beat, so we
 * retry a few times with a short backoff before giving up.
 */
async function confirmObjectInS3(
  bucket: string,
  key: string,
  attempts = 5
): Promise<boolean> {
  const s3 = getS3Client()
  for (let i = 0; i < attempts; i++) {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      return true
    } catch {
      // Not there yet -- wait and retry (250ms, 500ms, 750ms, ...)
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 250 * (i + 1)))
      }
    }
  }
  return false
}

function mediaConvertClient() {
  const endpoint = process.env.MEDIACONVERT_ENDPOINT
  if (!endpoint) return null
  // Credentials are picked up from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
  // env vars, same as the rest of the AWS SDK calls in this app.
  return new MediaConvertClient({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint,
  })
}

/**
 * Submit a MediaConvert job for the given asset and update the row with the
 * resulting job id and processing_status. Designed to be fire-and-forget from
 * the submission POST -- failures are logged but don't break the response.
 */
export async function triggerMediaConvertForAsset(
  input: TriggerInput
): Promise<TriggerResult> {
  if (!VIDEO_EXT_REGEX.test(input.s3Key)) {
    return { ok: false, reason: 'not_a_video_extension' }
  }

  const bucket = process.env.AWS_S3_BUCKET
  const roleArn = process.env.MEDIACONVERT_ROLE_ARN
  const mc = mediaConvertClient()

  if (!bucket || !roleArn || !mc) {
    console.warn(
      '[mediaconvert] not configured; skipping trigger',
      { hasBucket: !!bucket, hasRoleArn: !!roleArn, hasEndpoint: !!mc }
    )
    return { ok: false, reason: 'not_configured' }
  }

  // Gate: only push the MediaConvert job once the source file is actually in
  // S3. If it isn't there after a few retries, bail -- staff can re-trigger
  // later from /admin/ugc/[id] once the upload settles.
  const present = await confirmObjectInS3(bucket, input.s3Key)
  if (!present) {
    console.warn('[mediaconvert] source not found in S3, skipping', {
      bucket,
      key: input.s3Key,
    })
    return { ok: false, reason: 's3_object_not_found' }
  }

  const settings = buildJobSettings(bucket, input.s3Key)
  if (!settings) {
    return { ok: false, reason: 'invalid_s3_key' }
  }

  try {
    const result = await mc.send(
      new CreateJobCommand({
        Role: roleArn,
        Settings: settings,
        UserMetadata: {
          asset_id: input.assetId,
          source_key: input.s3Key,
        },
      })
    )

    const jobId = result.Job?.Id
    if (!jobId) {
      return { ok: false, reason: 'no_job_id_returned' }
    }

    // Best-effort DB write -- if this fails we still return ok because the
    // job is already submitted. The retry-processing endpoint can recover.
    try {
      const admin = createAdminClient()
      await admin
        .from('ugc_submission_assets')
        .update({
          mediaconvert_job_id: jobId,
          processing_status: 'processing',
        })
        .eq('id', input.assetId)
    } catch (err) {
      console.error('[mediaconvert] DB update failed after job submit', err)
    }

    return { ok: true, jobId }
  } catch (err) {
    console.error('[mediaconvert] CreateJob failed', err)
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'create_job_failed',
    }
  }
}

/**
 * Fire MediaConvert jobs for every video asset on a given submission. Safe to
 * call from a submission POST handler -- collects results but doesn't throw.
 */
export async function triggerMediaConvertForVideoAssets(
  assets: Array<{ id: string; s3_key: string; asset_type: string }>
): Promise<TriggerResult[]> {
  const videoAssets = assets.filter((a) => a.asset_type === 'video')
  if (videoAssets.length === 0) return []

  const results: TriggerResult[] = []
  for (const asset of videoAssets) {
    results.push(
      await triggerMediaConvertForAsset({
        assetId: asset.id,
        s3Key: asset.s3_key,
      })
    )
  }
  return results
}

// ---------------------------------------------------------------------------
// Reconciliation -- flip processing_status -> ready once outputs exist.
//
// The old Lambda webhook (`/api/ugc/processing-complete`) is gone. In the
// VF-style flow, nothing pushes a "done" event, so we reconcile from the
// server: check the MediaConvert job status and/or the presence of the
// processed files in S3, then update the asset row.
// ---------------------------------------------------------------------------

interface ProcessedUrls {
  '1080p'?: string
  '720p'?: string
  original?: string
  thumb?: string
}

/**
 * Derive the expected processed-output S3 keys from a source key.
 *   user-uploads/.../uploads/{base}.mp4
 *     -> user-uploads/.../uploads/processed/{base}-1080p.mp4  (etc.)
 */
export function expectedProcessedKeys(s3Key: string) {
  if (!VIDEO_EXT_REGEX.test(s3Key)) return null
  const lastSlash = s3Key.lastIndexOf('/')
  const dir = s3Key.substring(0, lastSlash)
  const filename = s3Key.substring(lastSlash + 1)
  const base = filename.replace(VIDEO_EXT_REGEX, '')
  const prefix = `${dir}/processed/${base}`
  return {
    '1080p': `${prefix}-1080p.mp4`,
    '720p': `${prefix}-720p.mp4`,
    original: `${prefix}-original.mp4`,
    thumb: `${prefix}-thumb.0000000.jpg`,
  }
}

async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await getS3Client().send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    )
    return true
  } catch {
    return false
  }
}

/**
 * Ask MediaConvert whether a job errored. Returns 'error' | 'complete' |
 * 'in_progress' | 'unknown'. Never throws.
 */
async function getJobState(
  jobId: string
): Promise<'error' | 'complete' | 'in_progress' | 'unknown'> {
  const mc = mediaConvertClient()
  if (!mc) return 'unknown'
  try {
    const res = await mc.send(new GetJobCommand({ Id: jobId }))
    const status = res.Job?.Status
    if (status === 'ERROR' || status === 'CANCELED') return 'error'
    if (status === 'COMPLETE') return 'complete'
    if (status === 'SUBMITTED' || status === 'PROGRESSING') return 'in_progress'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export interface ReconcileAssetResult {
  assetId: string
  status: 'ready' | 'processing' | 'failed' | 'skipped'
}

/**
 * Reconcile a single video asset row given its current DB values.
 * - If the processed outputs exist in S3 -> mark ready + populate processed_urls.
 * - Else if the MediaConvert job errored -> mark failed.
 * - Else leave as-is (still processing).
 */
export async function reconcileVideoAsset(asset: {
  id: string
  s3_key: string
  mediaconvert_job_id: string | null
}): Promise<ReconcileAssetResult> {
  const bucket = process.env.AWS_S3_BUCKET
  const keys = expectedProcessedKeys(asset.s3_key)
  if (!bucket || !keys) {
    return { assetId: asset.id, status: 'skipped' }
  }

  // Check which renditions actually landed in S3.
  const [has1080, has720, hasOriginal, hasThumb] = await Promise.all([
    objectExists(bucket, keys['1080p']),
    objectExists(bucket, keys['720p']),
    objectExists(bucket, keys.original),
    objectExists(bucket, keys.thumb),
  ])

  const admin = createAdminClient()

  // We consider the asset playable once the 1080p rendition + thumbnail exist.
  if (has1080 && hasThumb) {
    const processed: ProcessedUrls = { '1080p': s3PublicUrl(keys['1080p']) }
    if (has720) processed['720p'] = s3PublicUrl(keys['720p'])
    if (hasOriginal) processed.original = s3PublicUrl(keys.original)
    if (hasThumb) processed.thumb = s3PublicUrl(keys.thumb)

    await admin
      .from('ugc_submission_assets')
      .update({
        processing_status: 'ready',
        processed_urls: processed,
        url: processed['1080p'],
      })
      .eq('id', asset.id)
    return { assetId: asset.id, status: 'ready' }
  }

  // No outputs yet -- if the job explicitly errored, mark failed.
  if (asset.mediaconvert_job_id) {
    const state = await getJobState(asset.mediaconvert_job_id)
    if (state === 'error') {
      await admin
        .from('ugc_submission_assets')
        .update({ processing_status: 'failed' })
        .eq('id', asset.id)
      return { assetId: asset.id, status: 'failed' }
    }
  }

  return { assetId: asset.id, status: 'processing' }
}

/**
 * Find every video asset that isn't finished yet and reconcile it. Safe to run
 * from a cron on a short interval -- all operations are idempotent.
 */
export async function reconcileStuckVideoAssets(limit = 100) {
  const admin = createAdminClient()
  const { data: assets, error } = await admin
    .from('ugc_submission_assets')
    .select('id, s3_key, mediaconvert_job_id, processing_status')
    .eq('asset_type', 'video')
    .in('processing_status', ['uploaded', 'processing'])
    .limit(limit)

  if (error) {
    console.error('[mediaconvert] reconcile lookup failed', error)
    return { scanned: 0, ready: 0, failed: 0, stillProcessing: 0 }
  }

  let ready = 0
  let failed = 0
  let stillProcessing = 0

  for (const asset of assets || []) {
    // An 'uploaded' asset never got a job (e.g. trigger failed) -- try to
    // (re)submit it before reconciling. reconcile still works because outputs
    // may already exist from a prior manual run.
    if (asset.processing_status === 'uploaded' && !asset.mediaconvert_job_id) {
      await triggerMediaConvertForAsset({
        assetId: asset.id,
        s3Key: asset.s3_key,
      })
    }

    const result = await reconcileVideoAsset(asset)
    if (result.status === 'ready') ready++
    else if (result.status === 'failed') failed++
    else stillProcessing++
  }

  return { scanned: (assets || []).length, ready, failed, stillProcessing }
}

// ---------------------------------------------------------------------------
// MediaConvert job settings
// ---------------------------------------------------------------------------
export function buildJobSettings(bucket: string, s3Key: string) {
  if (!VIDEO_EXT_REGEX.test(s3Key)) return null

  // MediaConvert FILE_GROUP_SETTINGS automatically prepends the input file's
  // base name to each output, so NameModifier is ONLY the suffix (e.g.
  // "-1080p"). Producing "{base}-1080p.mp4", "{base}-thumb.0000000.jpg", etc.
  const lastSlash = s3Key.lastIndexOf('/')
  const dir = s3Key.substring(0, lastSlash)
  const destinationDir = `s3://${bucket}/${dir}/processed/`

  return {
    Inputs: [
      {
        FileInput: `s3://${bucket}/${s3Key}`,
        AudioSelectors: {
          'Audio Selector 1': { DefaultSelection: 'DEFAULT' as const },
        },
        VideoSelector: {},
        TimecodeSource: 'ZEROBASED' as const,
      },
    ],
    OutputGroups: [
      // 1) Thumbnail (single frame, name will become {base}-thumb.0000000.jpg)
      {
        Name: 'Thumbnail',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS' as const,
          FileGroupSettings: { Destination: destinationDir },
        },
        Outputs: [
          {
            NameModifier: '-thumb',
            ContainerSettings: { Container: 'RAW' as const },
            VideoDescription: {
              Width: 1920,
              Height: 1080,
              CodecSettings: {
                Codec: 'FRAME_CAPTURE' as const,
                FrameCaptureSettings: {
                  FramerateNumerator: 1,
                  FramerateDenominator: 1,
                  MaxCaptures: 1,
                  Quality: 90,
                },
              },
            },
          },
        ],
      },
      // 2) Original (high-quality mp4)
      {
        Name: 'OriginalCompressed',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS' as const,
          FileGroupSettings: { Destination: destinationDir },
        },
        Outputs: [
          {
            NameModifier: '-original',
            ContainerSettings: {
              Container: 'MP4' as const,
              Mp4Settings: { MoovPlacement: 'PROGRESSIVE_DOWNLOAD' as const },
            },
            VideoDescription: {
              CodecSettings: {
                Codec: 'H_264' as const,
                H264Settings: {
                  RateControlMode: 'QVBR' as const,
                  MaxBitrate: 10_000_000,
                  QvbrSettings: { QvbrQualityLevel: 8 },
                  CodecProfile: 'HIGH' as const,
                },
              },
            },
            AudioDescriptions: [
              {
                CodecSettings: {
                  Codec: 'AAC' as const,
                  AacSettings: {
                    Bitrate: 128_000,
                    SampleRate: 48_000,
                    CodingMode: 'CODING_MODE_2_0' as const,
                  },
                },
              },
            ],
          },
        ],
      },
      // 3) 1080p (cap at 6 Mbps for fast progressive playback)
      {
        Name: '1080p',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS' as const,
          FileGroupSettings: { Destination: destinationDir },
        },
        Outputs: [
          {
            NameModifier: '-1080p',
            ContainerSettings: {
              Container: 'MP4' as const,
              Mp4Settings: { MoovPlacement: 'PROGRESSIVE_DOWNLOAD' as const },
            },
            VideoDescription: {
              Width: 1920,
              Height: 1080,
              CodecSettings: {
                Codec: 'H_264' as const,
                H264Settings: {
                  RateControlMode: 'QVBR' as const,
                  MaxBitrate: 6_000_000,
                  QvbrSettings: { QvbrQualityLevel: 8 },
                  CodecProfile: 'HIGH' as const,
                  CodecLevel: 'LEVEL_4_1' as const,
                },
              },
            },
            AudioDescriptions: [
              {
                CodecSettings: {
                  Codec: 'AAC' as const,
                  AacSettings: {
                    Bitrate: 128_000,
                    SampleRate: 48_000,
                    CodingMode: 'CODING_MODE_2_0' as const,
                  },
                },
              },
            ],
          },
        ],
      },
      // 4) 720p (mobile fallback)
      {
        Name: '720p',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS' as const,
          FileGroupSettings: { Destination: destinationDir },
        },
        Outputs: [
          {
            NameModifier: '-720p',
            ContainerSettings: {
              Container: 'MP4' as const,
              Mp4Settings: { MoovPlacement: 'PROGRESSIVE_DOWNLOAD' as const },
            },
            VideoDescription: {
              Width: 1280,
              Height: 720,
              CodecSettings: {
                Codec: 'H_264' as const,
                H264Settings: {
                  RateControlMode: 'QVBR' as const,
                  MaxBitrate: 3_000_000,
                  QvbrSettings: { QvbrQualityLevel: 7 },
                  CodecProfile: 'MAIN' as const,
                  CodecLevel: 'LEVEL_4' as const,
                },
              },
            },
            AudioDescriptions: [
              {
                CodecSettings: {
                  Codec: 'AAC' as const,
                  AacSettings: {
                    Bitrate: 96_000,
                    SampleRate: 48_000,
                    CodingMode: 'CODING_MODE_2_0' as const,
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  }
}
