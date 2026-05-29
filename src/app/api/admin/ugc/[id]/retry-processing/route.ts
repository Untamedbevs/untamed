import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import {
  MediaConvertClient,
  CreateJobCommand,
} from '@aws-sdk/client-mediaconvert'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/ugc/[id]/retry-processing
 *
 * Staff-triggered re-submit of a stuck video to MediaConvert. Useful when the
 * Lambda S3 trigger missed an upload or the previous job failed.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const staff = await resolveStaff()
  if (!staff) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (staff.role === 'contractor_limited') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const admin = createAdminClient()

  const { data: assets, error } = await admin
    .from('ugc_submission_assets')
    .select('id, s3_key, asset_type')
    .eq('submission_id', id)
    .eq('asset_type', 'video')

  if (error) {
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
  }
  if (!assets || assets.length === 0) {
    return NextResponse.json({ error: 'no_videos' }, { status: 404 })
  }

  const endpoint = process.env.MEDIACONVERT_ENDPOINT
  const roleArn = process.env.MEDIACONVERT_ROLE_ARN
  const bucket = process.env.AWS_S3_BUCKET
  if (!endpoint || !roleArn || !bucket) {
    return NextResponse.json(
      { error: 'mediaconvert_not_configured' },
      { status: 500 }
    )
  }

  const mc = new MediaConvertClient({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint,
  })

  const jobIds: string[] = []
  for (const asset of assets) {
    const settings = buildJobSettings(bucket, asset.s3_key)
    if (!settings) continue
    try {
      const result = await mc.send(
        new CreateJobCommand({
          Role: roleArn,
          Settings: settings,
        })
      )
      if (result.Job?.Id) {
        jobIds.push(result.Job.Id)
        await admin
          .from('ugc_submission_assets')
          .update({
            mediaconvert_job_id: result.Job.Id,
            processing_status: 'processing',
          })
          .eq('id', asset.id)
      }
    } catch (err) {
      console.error('Retry MediaConvert job failed', err)
    }
  }

  return NextResponse.json({ ok: true, jobIds })
}

const VIDEO_EXT_REGEX = /\.(mp4|mov|m4v|webm|mkv|avi)$/i

function buildJobSettings(bucket: string, s3Key: string) {
  if (!VIDEO_EXT_REGEX.test(s3Key)) return null
  const lastSlash = s3Key.lastIndexOf('/')
  const dir = s3Key.substring(0, lastSlash)
  const filename = s3Key.substring(lastSlash + 1)
  const base = filename.replace(VIDEO_EXT_REGEX, '')
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
      {
        Name: 'Thumbnail',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS' as const,
          FileGroupSettings: { Destination: destinationDir },
        },
        Outputs: [
          {
            NameModifier: `${base}-thumb`,
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
      {
        Name: 'OriginalCompressed',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS' as const,
          FileGroupSettings: { Destination: destinationDir },
        },
        Outputs: [
          {
            NameModifier: `${base}-original`,
            ContainerSettings: { Container: 'MP4' as const, Mp4Settings: {} },
            VideoDescription: {
              CodecSettings: {
                Codec: 'H_264' as const,
                H264Settings: {
                  RateControlMode: 'QVBR' as const,
                  MaxBitrate: 10000000,
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
                    Bitrate: 128000,
                    SampleRate: 48000,
                    CodingMode: 'CODING_MODE_2_0' as const,
                  },
                },
              },
            ],
          },
        ],
      },
      {
        Name: '1080p',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS' as const,
          FileGroupSettings: { Destination: destinationDir },
        },
        Outputs: [
          {
            NameModifier: `${base}-1080p`,
            ContainerSettings: { Container: 'MP4' as const, Mp4Settings: {} },
            VideoDescription: {
              Width: 1920,
              Height: 1080,
              CodecSettings: {
                Codec: 'H_264' as const,
                H264Settings: {
                  RateControlMode: 'QVBR' as const,
                  MaxBitrate: 6000000,
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
                    Bitrate: 128000,
                    SampleRate: 48000,
                    CodingMode: 'CODING_MODE_2_0' as const,
                  },
                },
              },
            ],
          },
        ],
      },
      {
        Name: '720p',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS' as const,
          FileGroupSettings: { Destination: destinationDir },
        },
        Outputs: [
          {
            NameModifier: `${base}-720p`,
            ContainerSettings: { Container: 'MP4' as const, Mp4Settings: {} },
            VideoDescription: {
              Width: 1280,
              Height: 720,
              CodecSettings: {
                Codec: 'H_264' as const,
                H264Settings: {
                  RateControlMode: 'QVBR' as const,
                  MaxBitrate: 3000000,
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
                    Bitrate: 96000,
                    SampleRate: 48000,
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
