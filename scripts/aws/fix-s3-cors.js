#!/usr/bin/env node

/**
 * S3 CORS Configuration for Untamed UGC uploads.
 *
 * Allows the browser to PUT directly to S3 via presigned URLs (required for
 * the >500KB tier of /api/portal/upload/presigned and >100MB multipart uploads).
 *
 * Usage:
 *   node scripts/aws/fix-s3-cors.js
 *
 * Reads AWS credentials + AWS_S3_BUCKET + AWS_REGION from .env.local.
 */

const {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} = require('@aws-sdk/client-s3')
require('dotenv').config({ path: '.env.local' })

const BUCKET_NAME = process.env.AWS_S3_BUCKET
const REGION = process.env.AWS_REGION || 'us-east-1'

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const corsConfiguration = {
  CORSRules: [
    {
      AllowedHeaders: ['*'],
      AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
      AllowedOrigins: [
        'http://localhost:3000',
        'https://untamedbeverages.com',
        'https://www.untamedbeverages.com',
        'https://*.vercel.app',
      ],
      ExposeHeaders: [
        'ETag',
        'x-amz-server-side-encryption',
        'x-amz-request-id',
        'x-amz-id-2',
      ],
      MaxAgeSeconds: 3600,
    },
  ],
}

async function getCurrentCors() {
  try {
    const response = await s3Client.send(
      new GetBucketCorsCommand({ Bucket: BUCKET_NAME })
    )
    return response.CORSRules
  } catch (error) {
    if (error.name === 'NoSuchCORSConfiguration') return null
    throw error
  }
}

async function applyCors() {
  await s3Client.send(
    new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: corsConfiguration,
    })
  )
}

async function main() {
  console.log('Untamed S3 CORS configuration')
  console.log(`Bucket: ${BUCKET_NAME}`)
  console.log(`Region: ${REGION}`)
  console.log('')

  if (!BUCKET_NAME) {
    console.error('AWS_S3_BUCKET is required in .env.local')
    process.exit(1)
  }
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('AWS credentials missing in .env.local')
    process.exit(1)
  }

  const current = await getCurrentCors()
  if (current) {
    console.log('Current CORS rules:')
    console.log(JSON.stringify(current, null, 2))
    console.log('')
  }

  console.log('Applying new CORS configuration...')
  await applyCors()

  await new Promise((r) => setTimeout(r, 2000))

  const updated = await getCurrentCors()
  if (!updated || updated.length === 0) {
    console.error('CORS verification failed.')
    process.exit(1)
  }

  console.log('')
  console.log('CORS configured. Browser uploads should now work via presigned URLs.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
