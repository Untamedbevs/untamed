#!/usr/bin/env node
/**
 * Read-only: does AccelPay send a marketing opt-in or age field with orders?
 *
 * Scans stored AccelPay payloads (loyalty_orders.raw_payload and captured
 * webhook_events) and lists every field path whose name looks like consent,
 * marketing, newsletter, or age. Prints field names, how often each appears,
 * and true/false counts for booleans. Never prints values or customer data.
 *
 * Usage: node --env-file=.env.local scripts/email/inspect-accelpay-consent.mjs
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const INTERESTING = /consent|opt.?in|opt.?out|marketing|newsletter|subscri|accepts?_?(email|marketing)|promo|email_?pref|birth|dob|age_?verif|over_?21|is_?21|adult/i
const MAX_ROWS = 2000
const PAGE = 500

async function fetchRows(path) {
  const rows = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + PAGE - 1}` },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`${path.split('?')[0]}: HTTP ${res.status}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < PAGE) break
  }
  return rows
}

/** Walk an object and record every leaf path (array indexes collapsed to []). */
function walk(value, path, stats) {
  if (value === null || value === undefined) return
  if (Array.isArray(value)) {
    for (const item of value) walk(item, `${path}[]`, stats)
    return
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k, stats)
    return
  }
  const entry = stats.get(path) || { count: 0, types: new Map(), trues: 0, falses: 0 }
  entry.count++
  const type = typeof value
  entry.types.set(type, (entry.types.get(type) || 0) + 1)
  if (value === true || value === 'true' || value === 1 || value === '1') entry.trues++
  if (value === false || value === 'false' || value === 0 || value === '0') entry.falses++
  stats.set(path, entry)
}

function report(label, payloads) {
  const stats = new Map()
  for (const p of payloads) walk(p, '', stats)
  const matches = [...stats.entries()].filter(([path]) => INTERESTING.test(path.split('.').pop() || ''))
  console.log(`\n${label}: ${payloads.length} payloads, ${stats.size} distinct field paths`)
  if (matches.length === 0) {
    console.log('  No consent, marketing, newsletter, or age fields found.')
    return
  }
  for (const [path, e] of matches.sort((a, b) => b[1].count - a[1].count)) {
    const types = [...e.types.entries()].map(([t, n]) => `${t}:${n}`).join(' ')
    console.log(`  ${path}  (in ${e.count}; ${types}; true-ish ${e.trues}, false-ish ${e.falses})`)
  }
}

const orders = await fetchRows('loyalty_orders?select=raw_payload&raw_payload=not.is.null&order=created_at.desc')
report('loyalty_orders.raw_payload', orders.map((r) => r.raw_payload))

const events = await fetchRows('webhook_events?select=payload&source=eq.untamed-orders&order=received_at.desc')
report('webhook_events (untamed-orders)', events.map((r) => r.payload))
