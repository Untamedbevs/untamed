#!/usr/bin/env node
/**
 * One-off: register the AccelPay `new_order` webhook so online orders auto-credit
 * loyalty points.
 *
 * Usage:
 *   ACCELPAY_API_TOKEN=xxx \
 *   ACCELPAY_WEBHOOK_SECRET=yyy \
 *   WEBHOOK_BASE_URL=https://untamedbeverages.com \
 *   node scripts/accelpay/register-webhook.mjs
 *
 * Optional env:
 *   ACCELPAY_BRAND_ID   (default 5008728)
 *   ACCELPAY_API_BASE   (default https://api.accelpay.io)
 *
 * The webhook URL embeds the shared secret as ?token=, which the receiver
 * (/api/webhooks/untamed-orders) checks against ACCELPAY_WEBHOOK_SECRET.
 */

const token = process.env.ACCELPAY_API_TOKEN
const secret = process.env.ACCELPAY_WEBHOOK_SECRET
const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://untamedbeverages.com'
const brandId = process.env.ACCELPAY_BRAND_ID || '5008728'
const apiBase = (process.env.ACCELPAY_API_BASE || 'https://api.accelpay.io').replace(/\/$/, '')

if (!token) {
  console.error('Missing ACCELPAY_API_TOKEN')
  process.exit(1)
}
if (!secret) {
  console.error('Missing ACCELPAY_WEBHOOK_SECRET (used to authenticate incoming webhooks)')
  process.exit(1)
}

const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/webhooks/untamed-orders?token=${encodeURIComponent(secret)}`

const res = await fetch(`${apiBase}/v1/brands/${brandId}/webhooks`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    event: 'new_order',
    url: webhookUrl,
    name: 'Untamed Loyalty - Online Order Points',
  }),
})

const text = await res.text()
if (!res.ok) {
  console.error(`Failed (${res.status}):`, text)
  process.exit(1)
}

console.log('Webhook registered:')
console.log('  URL:', webhookUrl)
console.log('  Response:', text)
