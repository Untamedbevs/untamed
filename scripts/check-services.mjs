import nextEnv from '@next/env'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import nodemailer from 'nodemailer'
import { S3Client, HeadObjectCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3'
import { MediaConvertClient, ListJobsCommand } from '@aws-sdk/client-mediaconvert'
import { SESv2Client, GetAccountCommand, GetEmailIdentityCommand, GetConfigurationSetEventDestinationsCommand } from '@aws-sdk/client-sesv2'

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} })
const env = process.env
const results = []
const timeout = () => AbortSignal.timeout(20_000)
const safeCode = (error) => String(error?.code || error?.name || 'UnknownError').replace(/[^a-zA-Z0-9_:-]/g, '').slice(0,80)

async function check(name, action) {
  try {
    const detail = await action()
    results.push({ name, ok: true, detail })
    console.log(`PASS: ${name} — ${detail}`)
  } catch (error) {
    // Provider exception messages can contain request details. Print only codes.
    const detail = error?.safeDetail || safeCode(error)
    results.push({ name, ok: false, detail })
    console.log(`FAIL: ${name} — ${detail}`)
  }
}
function fail(detail) { throw { safeDetail: detail } }
async function get(url, headers = {}, method = 'GET') {
  const response = await fetch(url, { headers, method, signal: timeout(), redirect: 'error' })
  if (!response.ok) fail(`HTTP ${response.status}`)
  return response
}
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const adminHeaders = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
const credentials = { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
const s3 = new S3Client({ region: env.AWS_REGION, credentials, maxAttempts: 1 })
const sesCredentials = env.SES_ACCESS_KEY_ID && env.SES_SECRET_ACCESS_KEY
  ? { accessKeyId: env.SES_ACCESS_KEY_ID, secretAccessKey: env.SES_SECRET_ACCESS_KEY }
  : credentials
const ses = new SESv2Client({ region: env.SES_REGION || env.AWS_REGION || 'us-east-1', credentials: sesCredentials, maxAttempts: 1 })
const SENDING_DOMAIN = 'untamedbeverages.com'

const tables = new Set()
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir,entry.name)
    if (entry.isDirectory()) scan(path)
    else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      for (const m of readFileSync(path,'utf8').matchAll(/\.from\(\s*['"]([a-z][a-z0-9_]*)['"]\s*\)/g)) tables.add(m[1])
    }
  }
}
scan('src')

console.log('Read-only provider checks. No email, model generation, uploads, events, or jobs are submitted.')
await Promise.all([
  check('Supabase public auth configuration', async () => {
    await get(`${supabaseUrl}/auth/v1/settings`, { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLIC_API_KEY })
    return 'public key accepted'
  }),
  check('Supabase service key and app tables', async () => {
    const response = await get(`${supabaseUrl}/rest/v1/`, { ...adminHeaders, Accept:'application/openapi+json' })
    const schema = await response.json()
    const missing = [...tables].filter(table => !schema.paths?.[`/${table}`])
    // Exercise a real database SELECT without retrieving any rows.
    await get(`${supabaseUrl}/rest/v1/staff?select=id&limit=0`, adminHeaders)
    if (missing.length) fail(`service key accepted; not exposed in REST schema: ${missing.sort().join(', ')}`)
    return `${tables.size} referenced tables exposed; zero-row SELECT accepted`
  }),
  check('AWS S3 asset access', async () => {
    await s3.send(new HeadObjectCommand({ Bucket:env.AWS_S3_BUCKET, Key:'site-assets/images/logo-mark.png', ExpectedBucketOwner:'486471634272' }), { abortSignal:timeout() })
    return 'existing site asset readable in expected AWS account'
  }),
  check('AWS S3 localhost upload CORS', async () => {
    const { CORSRules=[] } = await s3.send(new GetBucketCorsCommand({ Bucket:env.AWS_S3_BUCKET }), { abortSignal:timeout() })
    const origin = new URL(env.NEXT_PUBLIC_SITE_URL).origin
    const matches = pattern => new RegExp(`^${pattern.split('*').map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')}$`).test(origin)
    if (!CORSRules.some(rule => rule.AllowedOrigins?.some(matches) && rule.AllowedMethods?.includes('PUT'))) fail('local site origin has no PUT CORS rule')
    return 'local site origin allows PUT (upload itself not tested)'
  }),
  check('AWS MediaConvert read access', async () => {
    const mc = new MediaConvertClient({ region:env.AWS_REGION, endpoint:env.MEDIACONVERT_ENDPOINT, credentials, maxAttempts:1 })
    try { await mc.send(new ListJobsCommand({ MaxResults:1 }), { abortSignal:timeout() }) }
    finally { mc.destroy() }
    return 'job listing authorized; no transcode job created'
  }),
  check('Media CDN site asset', async () => {
    await get(`${env.NEXT_PUBLIC_SITE_ASSET_BASE_URL.replace(/\/$/,'')}/images/logo-mark.png`, {}, 'HEAD')
    return 'configured public asset URL returned HTTP 200'
  }),
  check('Fal API authentication', async () => {
    await get('https://api.fal.ai/v1/models?limit=1', { Authorization:`Key ${env.FAL_KEY}` })
    return 'authenticated model catalog accepted; no generation submitted'
  }),
  check('AI Gateway authentication and model availability', async () => {
    const headers = { Authorization:`Bearer ${env.AI_GATEWAY_API_KEY}` }
    const credits = await (await get('https://ai-gateway.vercel.sh/v1/credits', headers)).json()
    const models = await (await get('https://ai-gateway.vercel.sh/v1/models', headers)).json()
    if (!models.data?.some(model=>model.id==='google/gemini-2.5-flash')) fail('configured campaign model absent from catalog')
    if (Number(credits.balance) <= 0) fail('authentication accepted, but no positive credit balance')
    return 'key accepted; campaign model listed; positive credit balance'
  }),
  check('Google SMTP STARTTLS and authentication', async () => {
    const transporter = nodemailer.createTransport({
      host:env.GOOGLE_SMTP_HOST, port:Number(env.GOOGLE_SMTP_PORT||587), secure:env.GOOGLE_SMTP_PORT==='465', requireTLS:true,
      auth:{ user:env.GOOGLE_SMTP_USER, pass:env.GOOGLE_SMTP_APP_PASSWORD },
      connectionTimeout:15_000, greetingTimeout:15_000, socketTimeout:15_000,
    })
    try {
      try { await transporter.verify() }
      catch (error) {
        if (!['ECONNECTION','ETIMEDOUT','ECONNRESET'].includes(error.code)) throw error
        await new Promise(resolve=>setTimeout(resolve, 500))
        await transporter.verify()
      }
    } finally { transporter.close() }
    return 'connection and login accepted; no message sent'
  }),
  check('Amazon SES account status', async () => {
    const account = await ses.send(new GetAccountCommand({}), { abortSignal:timeout() })
    const quota = account.SendQuota || {}
    const summary = `${quota.Max24HourSend ?? '?'}/day, ${quota.MaxSendRate ?? '?'}/s, enforcement ${account.EnforcementStatus || 'unknown'}`
    if (!account.SendingEnabled) fail(`sending disabled (${summary})`)
    if (!account.ProductionAccessEnabled) fail(`still in the SES sandbox; request production access (${summary})`)
    return `production access, sending enabled (${summary})`
  }),
  check('Amazon SES sending domain', async () => {
    const identity = await ses.send(new GetEmailIdentityCommand({ EmailIdentity:SENDING_DOMAIN }), { abortSignal:timeout() })
    const dkim = identity.DkimAttributes?.Status || 'NOT_STARTED'
    if (!identity.VerifiedForSendingStatus) fail(`${SENDING_DOMAIN} not verified for sending (DKIM ${dkim})`)
    if (dkim !== 'SUCCESS') fail(`${SENDING_DOMAIN} verified but DKIM is ${dkim}`)
    return `${SENDING_DOMAIN} verified; DKIM signing active`
  }),
  check('Amazon SES marketing events to webhook topic', async () => {
    if (!env.SES_CONFIGURATION_SET_MARKETING) fail('SES_CONFIGURATION_SET_MARKETING not set')
    const { EventDestinations=[] } = await ses.send(new GetConfigurationSetEventDestinationsCommand({ ConfigurationSetName:env.SES_CONFIGURATION_SET_MARKETING }), { abortSignal:timeout() })
    const topics = (env.SES_SNS_TOPIC_ARNS || '').split(',').map(t=>t.trim()).filter(Boolean)
    const sns = EventDestinations.filter(d => d.Enabled && d.SnsDestination && topics.includes(d.SnsDestination.TopicArn))
    const types = new Set(sns.flatMap(d => d.MatchingEventTypes || []))
    const missing = ['BOUNCE','COMPLAINT','DELIVERY'].filter(t => !types.has(t))
    if (!sns.length) fail('no enabled SNS destination for a topic in SES_SNS_TOPIC_ARNS')
    if (missing.length) fail(`event destination missing ${missing.join(', ')}`)
    return `bounce, complaint, delivery${types.has('OPEN') ? ', open' : ''}${types.has('CLICK') ? ', click' : ''} events publish to an allowed topic`
  }),
  check('Meta token identity', async () => {
    await get('https://graph.facebook.com/v26.0/me?fields=id', { Authorization:`Bearer ${env.META_CAPI_ACCESS_TOKEN}` })
    return 'token accepted; no conversion event sent'
  }),
  check('Meta pixel access', async () => {
    await get(`https://graph.facebook.com/v26.0/${env.NEXT_PUBLIC_META_PIXEL_ID}?fields=id`, { Authorization:`Bearer ${env.META_CAPI_ACCESS_TOKEN}` })
    return 'configured pixel metadata accessible'
  }),
])
s3.destroy()
ses.destroy()
console.log(`\n${results.filter(r=>r.ok).length}/${results.length} read-only checks passed.`)
console.log('Not covered: signed-in user flows, write permissions, email delivery, paid generation, transcode submission, remote webhook secrets, or deployment settings.')
process.exitCode = results.some(r=>!r.ok) ? 1 : 0
