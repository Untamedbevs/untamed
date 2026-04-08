#!/usr/bin/env node
/**
 * Upload everything under ./public to S3 so paths like /images/can.png are reachable via HTTPS
 * (required for Fal and other remote fetchers when you run Next locally).
 *
 * Prerequisites (same as app upload code):
 *   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET
 *
 * Optional:
 *   STATIC_ASSET_S3_PREFIX  (default: site-assets)  -> keys become site-assets/images/...
 *
 * After sync, set in .env.local:
 *   NEXT_PUBLIC_SITE_ASSET_BASE_URL=https://YOUR_CDN_OR_S3_PUBLIC_HOST/site-assets
 * Use the exact URL prefix that serves the bucket keys above (often MEDIA_CDN_URL + "/" + prefix).
 *
 * Run: npm run sync:assets
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { promises as fs } from 'fs'
import { join, relative, sep } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC_DIR = join(ROOT, 'public')
const PREFIX = (process.env.STATIC_ASSET_S3_PREFIX || 'site-assets').replace(/^\/+|\/+$/g, '')

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
}

function extMime(file) {
  const m = file.match(/\.[^.]+$/)
  return m ? MIME[m[0].toLowerCase()] || 'application/octet-stream' : 'application/octet-stream'
}

async function collectFiles(dir, base = dir, out = []) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (e) {
    if (e.code === 'ENOENT') return out
    throw e
  }
  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue
    const full = join(dir, ent.name)
    if (ent.isDirectory()) {
      await collectFiles(full, base, out)
    } else if (ent.isFile()) {
      out.push(full)
    }
  }
  return out
}

async function main() {
  const bucket = process.env.AWS_S3_BUCKET
  const region = process.env.AWS_REGION || 'us-east-1'
  if (!bucket) {
    console.error('Missing AWS_S3_BUCKET')
    process.exit(1)
  }

  const files = await collectFiles(PUBLIC_DIR)
  if (files.length === 0) {
    console.log('No files under public/ (add assets or create public/images/...). Nothing to upload.')
    process.exit(0)
  }

  const client = new S3Client({
    region,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  })

  let ok = 0
  for (const abs of files) {
    const rel = relative(PUBLIC_DIR, abs).split(sep).join('/')
    const Key = `${PREFIX}/${rel}`
    const Body = await fs.readFile(abs)
    const ContentType = extMime(abs)
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key,
        Body,
        ContentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    )
    console.log(`OK  s3://${bucket}/${Key}`)
    ok += 1
  }
  console.log(`\nUploaded ${ok} file(s). Set NEXT_PUBLIC_SITE_ASSET_BASE_URL to your HTTPS base for key prefix "${PREFIX}/".`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
