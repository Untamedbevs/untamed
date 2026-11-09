#!/usr/bin/env node
/**
 * Read-only DNS check for sending email from untamedbeverages.com through
 * both Google Workspace (staff mail) and Amazon SES (marketing).
 *
 * Usage:
 *   node scripts/email/check-email-dns.mjs
 *   node scripts/email/check-email-dns.mjs --ses-dkim token1,token2,token3
 *   node scripts/email/check-email-dns.mjs --mail-from bounce.untamedbeverages.com
 *
 * SES DKIM tokens come from scripts/aws/ses/setup-ses.mjs. Without them the
 * SES DKIM check is skipped. Only public DNS is queried; nothing is changed.
 *
 * DMARC passes for SES through DKIM (SES signs as untamedbeverages.com) and,
 * with the custom MAIL FROM subdomain, through aligned SPF as well. That
 * subdomain needs its own MX and SPF records, checked below.
 */

import { promises as dns } from 'node:dns'

const DOMAIN = 'untamedbeverages.com'
const argIndex = process.argv.indexOf('--ses-dkim')
const sesTokens = argIndex > -1 ? (process.argv[argIndex + 1] || '').split(',').map((t) => t.trim()).filter(Boolean) : []
const mailFromIndex = process.argv.indexOf('--mail-from')
const MAIL_FROM = mailFromIndex > -1 ? process.argv[mailFromIndex + 1] : `bounce.${DOMAIN}`

let failures = 0
const report = (ok, name, detail) => {
  if (ok === false) failures++
  console.log(`${ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL'}: ${name}: ${detail}`)
}
const txt = async (name) => {
  try {
    return (await dns.resolveTxt(name)).map((parts) => parts.join(''))
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') return []
    throw err
  }
}

console.log(`Email DNS for ${DOMAIN} (read-only)\n`)

// MX
try {
  const mx = await dns.resolveMx(DOMAIN)
  const google = mx.some((r) => /google\.com$|googlemail\.com$/i.test(r.exchange))
  report(mx.length > 0, 'MX', `${mx.map((r) => r.exchange).join(', ') || 'none'}${google ? ' (Google Workspace)' : ''}`)
} catch (err) {
  report(false, 'MX', err.code || String(err))
}

// SPF
const spf = (await txt(DOMAIN)).filter((r) => /^v=spf1\b/i.test(r))
if (spf.length === 0) {
  report(false, 'SPF', 'no v=spf1 record')
} else if (spf.length > 1) {
  report(false, 'SPF', `${spf.length} SPF records; there must be exactly one`)
} else {
  const record = spf[0]
  const google = /include:_spf\.google\.com/i.test(record)
  report(google, 'SPF', `${record}${google ? '' : ' (missing include:_spf.google.com for staff mail)'}`)
  const lookups = (record.match(/\b(include|a|mx|ptr|exists|redirect)[:=]?/gi) || []).length
  if (lookups > 10) report(false, 'SPF lookups', `${lookups} DNS-lookup terms; the limit is 10`)
}

// DMARC
const dmarc = (await txt(`_dmarc.${DOMAIN}`)).filter((r) => /^v=DMARC1\b/i.test(r))
if (dmarc.length !== 1) {
  report(false, 'DMARC', dmarc.length ? 'more than one DMARC record' : 'no _dmarc record (required by Gmail/Yahoo for bulk senders)')
} else {
  const policy = /\bp=(none|quarantine|reject)\b/i.exec(dmarc[0])?.[1] || 'missing'
  const rua = /\brua=/i.test(dmarc[0])
  report(policy !== 'missing', 'DMARC', `${dmarc[0]}`)
  if (!rua) report(false, 'DMARC reports', 'no rua= address, so you will not see who sends as your domain')
  if (policy === 'none') console.log('      note: p=none is fine while warming up; plan to move to quarantine once reports are clean.')
}

// Google Workspace DKIM (default selector)
const googleDkim = (await txt(`google._domainkey.${DOMAIN}`)).some((r) => /v=DKIM1/i.test(r))
report(googleDkim, 'Google DKIM', googleDkim ? 'google._domainkey published' : 'google._domainkey not found (staff mail is not DKIM-signed, or uses another selector)')

// SES custom MAIL FROM subdomain (bounce handling + aligned SPF)
try {
  const mx = await dns.resolveMx(MAIL_FROM)
  const ok = mx.some((r) => /^feedback-smtp\.[a-z0-9-]+\.amazonses\.com$/i.test(r.exchange))
  report(ok, 'SES MAIL FROM MX', `${MAIL_FROM} -> ${mx.map((r) => r.exchange).join(', ') || 'none'}`)
} catch (err) {
  report(false, 'SES MAIL FROM MX', `${MAIL_FROM} has no MX (${err.code || err})`)
}
const mailFromSpf = (await txt(MAIL_FROM)).filter((r) => /^v=spf1\b/i.test(r))
report(
  mailFromSpf.length === 1 && /include:amazonses\.com/i.test(mailFromSpf[0]),
  'SES MAIL FROM SPF',
  mailFromSpf[0] || `${MAIL_FROM} has no SPF record`
)

// SES DKIM
if (sesTokens.length === 0) {
  report(null, 'SES DKIM', 'pass --ses-dkim token1,token2,token3 (printed by setup-ses.mjs)')
} else {
  for (const token of sesTokens) {
    const name = `${token}._domainkey.${DOMAIN}`
    try {
      const target = await dns.resolveCname(name)
      const ok = target.some((t) => t.toLowerCase() === `${token}.dkim.amazonses.com`)
      report(ok, 'SES DKIM', `${name} -> ${target.join(', ')}`)
    } catch (err) {
      report(false, 'SES DKIM', `${name} not found (${err.code || err})`)
    }
  }
}

console.log(failures ? `\n${failures} check(s) need attention.` : '\nDNS looks ready.')
process.exitCode = failures ? 1 : 0
