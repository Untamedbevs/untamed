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
} from '@aws-sdk/client-mediaconvert'
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { getS3Client } from '@/lib/storage/s3'
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
