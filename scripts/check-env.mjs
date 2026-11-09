import nextEnv from '@next/env'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Match Next's development env loading, including .env.development.local.
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} })

const configured = (key) => {
  const value = process.env[key]?.trim()
  return Boolean(value && !/^(?:your[-_ ]|replace[-_ ]|changeme|<)/i.test(value))
}
const groups = [
  ['Core database and auth', true, [
    ['NEXT_PUBLIC_SUPABASE_URL'], ['NEXT_PUBLIC_SUPABASE_PUBLIC_API_KEY'],
    ['SUPABASE_SERVICE_ROLE_KEY'], ['NEXT_PUBLIC_SITE_URL'],
  ]],
  ['AWS media storage', false, [
    ['AWS_ACCESS_KEY_ID'], ['AWS_SECRET_ACCESS_KEY'], ['AWS_S3_BUCKET'],
  ]],
  ['Fal media generation', false, [['FAL_KEY']]],
  ['AI Gateway campaign planning', false, [['AI_GATEWAY_API_KEY', 'VERCEL_OIDC_TOKEN']]],
  ['SMTP email', false, [['GOOGLE_SMTP_USER'], ['GOOGLE_SMTP_APP_PASSWORD']]],
  ['Marketing email (Amazon SES)', false, [
    ['SES_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID'], ['SES_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY'],
    ['SES_CONFIGURATION_SET_MARKETING'], ['SES_SNS_TOPIC_ARNS'], ['EMAIL_POSTAL_ADDRESS'], ['CRON_SECRET'],
  ]],
  ['Meta ads', false, [
    ['META_ACCESS_TOKEN', 'META_CAPI_ACCESS_TOKEN'], ['META_AD_ACCOUNT_ID'],
    ['NEXT_PUBLIC_META_PIXEL_ID', 'META_PIXEL_ID'],
  ]],
  ['Meta conversion events', false, [
    ['META_CAPI_ACCESS_TOKEN', 'META_ACCESS_TOKEN'], ['NEXT_PUBLIC_META_PIXEL_ID'],
  ]],
  ['Meta organic publishing', false, [
    ['META_PAGE_ACCESS_TOKEN'], ['META_FB_PAGE_ID'], ['META_IG_USER_ID'],
  ]],
  ['AccelPay orders and webhooks', false, [['ACCELPAY_API_TOKEN'], ['ACCELPAY_WEBHOOK_SECRET']]],
  ['Scheduled jobs', false, [['CRON_SECRET']]],
  ['Internal operations', false, [['CE_OPS_SECRET']]],
  ['UGC video processing', false, [
    ['MEDIACONVERT_ENDPOINT'], ['MEDIACONVERT_ROLE_ARN'], ['UGC_LAMBDA_WEBHOOK_SECRET'],
  ]],
]

const full = process.argv.includes('--full')
let failures = 0
console.log('Configuration presence only; credentials and provider permissions are not verified.')
for (const [label, required, requirements] of groups) {
  const missing = requirements.filter((alternatives) => !alternatives.some(configured))
  console.log(`${missing.length ? 'MISSING' : 'SET'}: ${label}${required ? ' (core)' : ''}`)
  for (const alternatives of missing) console.log(`  ${alternatives.join(' OR ')}`)
  if (missing.length && (required || full)) failures++
}

for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SITE_URL', 'MEDIA_CDN_URL', 'NEXT_PUBLIC_SITE_ASSET_BASE_URL', 'MEDIACONVERT_ENDPOINT', 'ACCELPAY_API_BASE', 'APP_BASE_URL', 'WEBHOOK_BASE_URL', 'SITE_URL']) {
  if (!configured(key)) continue
  try {
    const url = new URL(process.env[key])
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error()
  } catch {
    console.log(`INVALID: ${key} must be an absolute HTTP(S) URL`)
    failures++
  }
}

const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_API_KEY?.trim()
if (publicKey?.startsWith('sb_secret_') || (publicKey && (() => {
  try { return JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url').toString()).role === 'service_role' } catch { return false }
})())) {
  console.log('INVALID: NEXT_PUBLIC_SUPABASE_PUBLIC_API_KEY contains a server-only Supabase key')
  failures++
}

// Detect new env references that have not yet been documented in the template.
const template = readFileSync('.env.example', 'utf8')
const documented = new Set([...template.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]))
const referenced = new Set()
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) scan(path)
    else if (/\.(?:[cm]?js|tsx?)$/.test(entry.name) && path !== join('scripts', 'check-env.mjs')) {
      for (const match of readFileSync(path, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) referenced.add(match[1])
    }
  }
}
scan('src')
scan('scripts')
for (const key of referenced) {
  if (!documented.has(key) && key !== 'NODE_ENV') {
    console.log(`UNDOCUMENTED: ${key}`)
    failures++
  }
}
console.log(`\n${referenced.size} source variable names checked against .env.example.`)
console.log(failures ? 'Setup is incomplete. Fill the missing settings and rerun.' : `Configuration presence check passed${full ? ' for all feature groups' : ' for core features'}.`)
process.exitCode = failures ? 1 : 0
