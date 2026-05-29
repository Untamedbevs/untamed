/**
 * Untamed UGC video processor Lambda
 *
 * Triggered by S3 ObjectCreated events for `user-uploads/{authUserId}/ugc/...`
 * keys. For each new video, submits a MediaConvert job that produces:
 *   - {base}-1080p.mp4
 *   - {base}-720p.mp4
 *   - {base}-original.mp4
 *   - {base}-thumb.0000000.jpg
 *
 * When the MediaConvert job completes (separate event from EventBridge or S3
 * ObjectCreated on the processed prefix), the function POSTs to
 * /api/ugc/processing-complete with the s3 key + processed URLs so the app
 * can update `ugc_submission_assets.processed_urls` and flip status to ready.
 *
 * Deploy:
 *   cd scripts/aws/lambda/untamed-video-processor
 *   zip -r function.zip index.js
 *   aws lambda create-function \
 *     --function-name untamed-video-processor \
 *     --runtime nodejs20.x \
 *     --role arn:aws:iam::ACCOUNT:role/untamed-video-processor-role \
 *     --handler index.handler \
 *     --timeout 60 \
 *     --memory-size 512 \
 *     --zip-file fileb://function.zip \
 *     --environment "Variables={MEDIACONVERT_ENDPOINT=...,MEDIACONVERT_ROLE_ARN=...,UGC_LAMBDA_WEBHOOK_SECRET=...,APP_BASE_URL=https://untamedbeverages.com}"
 *
 * Then add an S3 trigger:
 *   - prefix: user-uploads/
 *   - event: s3:ObjectCreated:*
 */

const {
  MediaConvertClient,
  CreateJobCommand,
} = require('@aws-sdk/client-mediaconvert')
const https = require('https')
const { URL } = require('url')

const VIDEO_EXT_REGEX = /\.(mp4|mov|m4v|webm|mkv|avi)$/i
const PROCESSED_SUFFIX_REGEX = /-(1080p|720p|original)\.(mp4)$/i
const THUMB_SUFFIX_REGEX = /-thumb\.\d+\.jpg$/i
const UGC_PREFIX = 'user-uploads/'
const UGC_FOLDER_REGEX = /\/ugc\/(uploads|recordings)\//

// ---------------------------------------------------------------------------
// Webhook helper
// ---------------------------------------------------------------------------
function postJson(urlString, payload, secret) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString)
    const body = JSON.stringify(payload)
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        port: url.port || 443,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-untamed-webhook-secret': secret,
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data)
          } else {
            reject(new Error(`Webhook ${res.statusCode}: ${data}`))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------
function isVideoUpload(s3Key) {
  if (!s3Key.startsWith(UGC_PREFIX)) return false
  if (!UGC_FOLDER_REGEX.test(s3Key)) return false
  if (!VIDEO_EXT_REGEX.test(s3Key)) return false
  if (PROCESSED_SUFFIX_REGEX.test(s3Key)) return false
  if (THUMB_SUFFIX_REGEX.test(s3Key)) return false
  if (s3Key.includes('/processed/')) return false
  return true
}

function isProcessedOutput(s3Key) {
  return PROCESSED_SUFFIX_REGEX.test(s3Key) || THUMB_SUFFIX_REGEX.test(s3Key)
}

function getDestinationPrefix(s3Key) {
  // input:  user-uploads/{userId}/ugc/uploads/{filename}.mov
  // output: user-uploads/{userId}/ugc/uploads/processed/{baseFilename}
  const lastSlash = s3Key.lastIndexOf('/')
  const dir = s3Key.substring(0, lastSlash)
  const filename = s3Key.substring(lastSlash + 1)
  const base = filename.replace(VIDEO_EXT_REGEX, '')
  return `${dir}/processed/${base}`
}

function getOriginalKeyFromProcessed(processedKey) {
  // user-uploads/{userId}/ugc/uploads/processed/file-1080p.mp4
  // → user-uploads/{userId}/ugc/uploads/file.{ext}
  // We don't know the original ext, but the webhook stores by
  // s3_key on the assets table, so we send the *processed* key + base name
  // and let the API match by base.
  return processedKey
}

// ---------------------------------------------------------------------------
// MediaConvert job builder (4 outputs: thumb, original, 1080p, 720p)
// ---------------------------------------------------------------------------
function buildMediaConvertJobSettings(inputBucket, s3Key, destinationBase) {
  const inputUri = `s3://${inputBucket}/${s3Key}`
  const destinationUri = `s3://${inputBucket}/${destinationBase.substring(
    0,
    destinationBase.lastIndexOf('/') + 1
  )}`
  const namePrefix = destinationBase.substring(
    destinationBase.lastIndexOf('/') + 1
  )

  return {
    Inputs: [
      {
        FileInput: inputUri,
        AudioSelectors: {
          'Audio Selector 1': { DefaultSelection: 'DEFAULT' },
        },
        VideoSelector: {},
        TimecodeSource: 'ZEROBASED',
      },
    ],
    OutputGroups: [
      // Thumbnail
      {
        Name: 'Thumbnail',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS',
          FileGroupSettings: { Destination: destinationUri },
        },
        Outputs: [
          {
            NameModifier: `${namePrefix}-thumb`,
            ContainerSettings: { Container: 'RAW' },
            VideoDescription: {
              Width: 1920,
              Height: 1080,
              ScalingBehavior: 'DEFAULT',
              CodecSettings: {
                Codec: 'FRAME_CAPTURE',
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
      // Original-quality compressed
      {
        Name: 'OriginalCompressed',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS',
          FileGroupSettings: { Destination: destinationUri },
        },
        Outputs: [
          {
            NameModifier: `${namePrefix}-original`,
            ContainerSettings: {
              Container: 'MP4',
              Mp4Settings: {},
            },
            VideoDescription: {
              ScalingBehavior: 'DEFAULT',
              CodecSettings: {
                Codec: 'H_264',
                H264Settings: {
                  RateControlMode: 'QVBR',
                  MaxBitrate: 10000000,
                  QvbrSettings: { QvbrQualityLevel: 8 },
                  CodecProfile: 'HIGH',
                  CodecLevel: 'AUTO',
                },
              },
            },
            AudioDescriptions: [
              {
                CodecSettings: {
                  Codec: 'AAC',
                  AacSettings: {
                    Bitrate: 128000,
                    SampleRate: 48000,
                    CodingMode: 'CODING_MODE_2_0',
                  },
                },
              },
            ],
          },
        ],
      },
      // 1080p
      {
        Name: '1080p',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS',
          FileGroupSettings: { Destination: destinationUri },
        },
        Outputs: [
          {
            NameModifier: `${namePrefix}-1080p`,
            ContainerSettings: {
              Container: 'MP4',
              Mp4Settings: {},
            },
            VideoDescription: {
              Width: 1920,
              Height: 1080,
              ScalingBehavior: 'DEFAULT',
              CodecSettings: {
                Codec: 'H_264',
                H264Settings: {
                  RateControlMode: 'QVBR',
                  MaxBitrate: 6000000,
                  QvbrSettings: { QvbrQualityLevel: 8 },
                  CodecProfile: 'HIGH',
                  CodecLevel: 'LEVEL_4_1',
                },
              },
            },
            AudioDescriptions: [
              {
                CodecSettings: {
                  Codec: 'AAC',
                  AacSettings: {
                    Bitrate: 128000,
                    SampleRate: 48000,
                    CodingMode: 'CODING_MODE_2_0',
                  },
                },
              },
            ],
          },
        ],
      },
      // 720p
      {
        Name: '720p',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS',
          FileGroupSettings: { Destination: destinationUri },
        },
        Outputs: [
          {
            NameModifier: `${namePrefix}-720p`,
            ContainerSettings: {
              Container: 'MP4',
              Mp4Settings: {},
            },
            VideoDescription: {
              Width: 1280,
              Height: 720,
              ScalingBehavior: 'DEFAULT',
              CodecSettings: {
                Codec: 'H_264',
                H264Settings: {
                  RateControlMode: 'QVBR',
                  MaxBitrate: 3000000,
                  QvbrSettings: { QvbrQualityLevel: 7 },
                  CodecProfile: 'MAIN',
                  CodecLevel: 'LEVEL_4',
                },
              },
            },
            AudioDescriptions: [
              {
                CodecSettings: {
                  Codec: 'AAC',
                  AacSettings: {
                    Bitrate: 96000,
                    SampleRate: 48000,
                    CodingMode: 'CODING_MODE_2_0',
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

// ---------------------------------------------------------------------------
// Main handler: dispatch by event source
// ---------------------------------------------------------------------------
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event))

  if (!event.Records || event.Records.length === 0) {
    console.log('No records to process')
    return { ok: true }
  }

  const mcEndpoint = process.env.MEDIACONVERT_ENDPOINT
  const mcRoleArn = process.env.MEDIACONVERT_ROLE_ARN
  const appBaseUrl = process.env.APP_BASE_URL || 'https://untamedbeverages.com'
  const webhookSecret = process.env.UGC_LAMBDA_WEBHOOK_SECRET
  const cdnBase = process.env.MEDIA_CDN_URL || ''

  const mcClient = new MediaConvertClient({ endpoint: mcEndpoint })

  for (const record of event.Records) {
    if (!record.s3 || !record.s3.object || !record.s3.bucket) continue

    const bucket = record.s3.bucket.name
    const s3Key = decodeURIComponent(
      record.s3.object.key.replace(/\+/g, ' ')
    )

    if (isVideoUpload(s3Key)) {
      console.log(`New UGC video upload: ${s3Key}`)
      try {
        const destinationBase = getDestinationPrefix(s3Key)
        const settings = buildMediaConvertJobSettings(bucket, s3Key, destinationBase)
        const result = await mcClient.send(
          new CreateJobCommand({
            Role: mcRoleArn,
            Settings: settings,
            UserMetadata: {
              source_key: s3Key,
              destination_base: destinationBase,
            },
          })
        )
        console.log(`Created MediaConvert job ${result.Job?.Id} for ${s3Key}`)

        if (webhookSecret) {
          await postJson(
            `${appBaseUrl}/api/ugc/processing-complete`,
            {
              event: 'job_created',
              s3Key,
              jobId: result.Job?.Id,
            },
            webhookSecret
          ).catch((err) =>
            console.warn('job_created webhook failed:', err.message)
          )
        }
      } catch (err) {
        console.error(`Failed to create MediaConvert job for ${s3Key}:`, err)
      }
      continue
    }

    if (isProcessedOutput(s3Key)) {
      console.log(`Processed output detected: ${s3Key}`)
      if (!webhookSecret) {
        console.warn('UGC_LAMBDA_WEBHOOK_SECRET not set, skipping webhook')
        continue
      }

      // Resolve sibling URLs
      const dir = s3Key.substring(0, s3Key.lastIndexOf('/'))
      const filename = s3Key.substring(s3Key.lastIndexOf('/') + 1)
      const base = filename
        .replace(/-thumb\.\d+\.jpg$/i, '')
        .replace(/-(1080p|720p|original)\.mp4$/i, '')
      const baseDir = dir

      const cdn = cdnBase ? cdnBase.replace(/\/$/, '') : null
      function url(suffix) {
        const key = `${baseDir}/${base}${suffix}`
        return cdn ? `${cdn}/${key}` : `s3://${bucket}/${key}`
      }

      const payload = {
        event: 'output_ready',
        s3Key, // the specific output that just landed
        baseS3Key: `${baseDir}/${base}`, // for matching against original asset
        outputs: {
          '1080p': url('-1080p.mp4'),
          '720p': url('-720p.mp4'),
          original: url('-original.mp4'),
          thumb: url('-thumb.0000000.jpg'),
        },
      }

      try {
        await postJson(
          `${appBaseUrl}/api/ugc/processing-complete`,
          payload,
          webhookSecret
        )
        console.log(`Webhook delivered for ${s3Key}`)
      } catch (err) {
        console.error(`Webhook failed for ${s3Key}:`, err.message)
      }
      continue
    }

    console.log(`Skipping non-UGC key: ${s3Key}`)
  }

  return { ok: true }
}

// Suppress unused-var lint on getOriginalKeyFromProcessed -- exported for tests
module.exports.isVideoUpload = isVideoUpload
module.exports.isProcessedOutput = isProcessedOutput
module.exports.getDestinationPrefix = getDestinationPrefix
module.exports.getOriginalKeyFromProcessed = getOriginalKeyFromProcessed
