/**
 * Block-based email content shared by campaigns, flows, and templates.
 *
 * Content is stored as an array of blocks (JSON) and rendered to
 * email-client-safe HTML (tables, inline styles) plus a plain-text version.
 *
 * Merge tags: {{name}} or {{name|fallback}}. Values are HTML-escaped. Unknown
 * tags render their fallback (or nothing). Links to Untamed's own site get UTM
 * tags so site analytics can attribute visits to the email.
 */

import { REWARDS } from '@/lib/loyalty/constants'

export type EmailBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'button'; label: string; url: string }
  | { type: 'image'; url: string; alt: string; href?: string }
  | { type: 'divider' }
  | { type: 'spacer'; height?: number }
  | { type: 'rewards' }
  | { type: 'order_items' }

export const BLOCK_TYPES: { type: EmailBlock['type']; label: string }[] = [
  { type: 'heading', label: 'Heading' },
  { type: 'text', label: 'Text' },
  { type: 'button', label: 'Button' },
  { type: 'image', label: 'Image' },
  { type: 'divider', label: 'Divider' },
  { type: 'spacer', label: 'Spacer' },
  { type: 'rewards', label: 'Rewards list' },
  { type: 'order_items', label: 'Ordered items' },
]

export const MERGE_TAGS: { tag: string; label: string }[] = [
  { tag: '{{first_name|there}}', label: 'First name' },
  { tag: '{{name}}', label: 'Name' },
  { tag: '{{email}}', label: 'Email' },
  { tag: '{{site_url}}', label: 'Site URL' },
  { tag: '{{portal_url}}', label: 'Portal URL' },
  { tag: '{{community_url}}', label: 'Community URL' },
  { tag: '{{points_balance}}', label: 'Points balance' },
]

/** Tags filled by flows from their trigger (order, credit, redemption). */
export const FLOW_MERGE_TAGS: { tag: string; label: string }[] = [
  { tag: '{{points}}', label: 'Points credited' },
  { tag: '{{credit_reason}}', label: 'Why points were credited' },
  { tag: '{{reward}}', label: 'Reward redeemed' },
  { tag: '{{points_cost}}', label: 'Reward points cost' },
  { tag: '{{order_items|your order}}', label: 'Ordered items' },
  { tag: '{{birthday}}', label: 'Birthday' },
]

export type MergeVars = Record<string, string | number | null | undefined | string[]>

const BRAND = {
  purple: '#9B30FF',
  text: '#D0D0D0',
  white: '#FFFFFF',
  muted: '#888888',
  card: '#1A1A1A',
  border: '#2A2A2A',
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function varToString(value: MergeVars[string]): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) {
    if (value.length <= 1) return value.join('')
    return `${value.slice(0, -1).join(', ')} and ${value[value.length - 1]}`
  }
  if (typeof value === 'number') return value.toLocaleString('en-US')
  return String(value)
}

const TAG_RE = /\{\{\s*([a-z_][a-z0-9_]*)\s*(?:\|([^}]*))?\}\}/gi

/** Replace merge tags with plain (unescaped) values. */
export function fillTags(text: string, vars: MergeVars): string {
  return text.replace(TAG_RE, (_m, name: string, fallback?: string) => {
    const value = varToString(vars[name.toLowerCase()])
    return value || (fallback ?? '').trim()
  })
}

/** Merge tags used in the text that aren't known variables (for content checks). */
export function unknownTags(text: string, known: string[]): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(TAG_RE)) {
    if (!known.includes(m[1].toLowerCase())) out.add(m[1])
  }
  return [...out]
}

export const KNOWN_TAG_NAMES = [
  'first_name', 'name', 'email', 'site_url', 'portal_url', 'portal_login_url', 'community_url', 'points_balance',
  'points', 'credit_reason', 'reward', 'points_cost', 'order_items', 'birthday',
]

const OWN_HOSTS = ['untamedbeverages.com', 'www.untamedbeverages.com', 'untamedbevs.com', 'www.untamedbevs.com']

/** Add UTM parameters to links on Untamed's own site. */
export function tagLink(url: string, utm: { campaign?: string | null; content?: string } | null, siteHost?: string): string {
  if (!utm?.campaign) return url
  try {
    const u = new URL(url)
    const own = OWN_HOSTS.includes(u.hostname) || (siteHost && u.hostname === siteHost)
    if (!own || u.searchParams.has('utm_source')) return url
    u.searchParams.set('utm_source', 'untamed_email')
    u.searchParams.set('utm_medium', 'email')
    u.searchParams.set('utm_campaign', utm.campaign)
    if (utm.content) u.searchParams.set('utm_content', utm.content)
    return u.toString()
  } catch {
    return url
  }
}

/** Minimal inline formatting for text blocks: **bold**, [label](url), line breaks. */
function formatInline(text: string, linkFor: (url: string) => string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#FFFFFF;">$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
      const href = linkFor(url.replace(/&amp;/g, '&'))
      return `<a href="${escapeHtml(href)}" style="color:${BRAND.purple};text-decoration:underline;">${label}</a>`
    })
}

function safeUrl(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:' ? u.toString() : null
  } catch {
    return null
  }
}

export interface RenderOptions {
  utmCampaign?: string | null
  siteHost?: string
}

/** Render blocks to inner email HTML and plain text. */
export function renderBlocks(
  blocks: EmailBlock[],
  vars: MergeVars,
  options: RenderOptions = {}
): { html: string; text: string } {
  const html: string[] = []
  const text: string[] = []
  const pointsBalance = Number(vars.points_balance ?? NaN)

  blocks.forEach((block, i) => {
    const link = (raw: string) => {
      const filled = safeUrl(fillTags(raw, vars).trim())
      return filled ? tagLink(filled, { campaign: options.utmCampaign, content: `block${i + 1}` }, options.siteHost) : null
    }

    switch (block.type) {
      case 'heading': {
        const t = fillTags(block.text || '', vars)
        if (!t.trim()) return
        html.push(`<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${BRAND.white};font-weight:700;">${escapeHtml(t)}</h1>`)
        text.push(t.toUpperCase())
        return
      }
      case 'text': {
        const t = fillTags(block.text || '', vars)
        if (!t.trim()) return
        for (const para of t.trim().split(/\n{2,}/)) {
          html.push(
            `<p style="margin:0 0 16px;color:${BRAND.text};font-size:15px;line-height:1.6;">${formatInline(para, (u) => link(u) || u).replace(/\n/g, '<br>')}</p>`
          )
        }
        text.push(t.trim().replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)'))
        return
      }
      case 'button': {
        const href = link(block.url || '')
        const label = fillTags(block.label || '', vars)
        if (!href || !label.trim()) return
        html.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
  <tr><td style="border-radius:999px;background:${BRAND.purple};">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 28px;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;border-radius:999px;">${escapeHtml(label)}</a>
  </td></tr>
</table>`)
        text.push(`${label}: ${href}`)
        return
      }
      case 'image': {
        const src = safeUrl(block.url || '')
        if (!src) return
        const alt = fillTags(block.alt || '', vars)
        const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="496" style="display:block;width:100%;max-width:496px;height:auto;border:0;border-radius:12px;">`
        const href = block.href ? link(block.href) : null
        html.push(`<div style="margin:0 0 20px;">${href ? `<a href="${escapeHtml(href)}">${img}</a>` : img}</div>`)
        if (alt) text.push(`[${alt}]${href ? ` ${href}` : ''}`)
        return
      }
      case 'divider':
        html.push(`<hr style="border:0;border-top:1px solid ${BRAND.border};margin:24px 0;">`)
        text.push('---')
        return
      case 'spacer':
        html.push(`<div style="height:${Math.min(Math.max(block.height || 16, 4), 80)}px;line-height:1px;font-size:1px;">&nbsp;</div>`)
        return
      case 'rewards': {
        const rows = REWARDS.map((r) => {
          const affordable = Number.isFinite(pointsBalance) && pointsBalance >= r.pointsCost
          return `<tr>
  <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.border};color:${BRAND.white};font-size:14px;">${escapeHtml(r.name)}${affordable ? ` <span style="color:${BRAND.purple};font-size:12px;">· you can redeem this</span>` : ''}</td>
  <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.border};color:${BRAND.text};font-size:14px;text-align:right;white-space:nowrap;">${r.pointsCost.toLocaleString('en-US')} pts</td>
</tr>`
        }).join('')
        html.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:${BRAND.card};border-radius:12px;">${rows}</table>`)
        text.push(REWARDS.map((r) => `- ${r.name}: ${r.pointsCost.toLocaleString('en-US')} points`).join('\n'))
        return
      }
      case 'order_items': {
        const items = Array.isArray(vars.order_items) ? vars.order_items : []
        if (items.length === 0) return
        html.push(`<ul style="margin:0 0 16px;padding-left:20px;color:${BRAND.text};font-size:15px;line-height:1.6;">${items.map((it) => `<li>${escapeHtml(String(it))}</li>`).join('')}</ul>`)
        text.push(items.map((it) => `- ${it}`).join('\n'))
        return
      }
    }
  })

  return { html: html.join('\n'), text: text.join('\n\n') }
}

/** Plain-text body (legacy blasts) as blocks, so everything renders one way. */
export function textToBlocks(body: string): EmailBlock[] {
  return [{ type: 'text', text: body }]
}

/** Validate and normalize untrusted block JSON from the admin UI. */
export function sanitizeBlocks(input: unknown): EmailBlock[] {
  if (!Array.isArray(input)) return []
  const out: EmailBlock[] = []
  for (const raw of input.slice(0, 60)) {
    const b = raw as Record<string, unknown>
    const s = (v: unknown, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '')
    switch (b?.type) {
      case 'heading': out.push({ type: 'heading', text: s(b.text, 300) }); break
      case 'text': out.push({ type: 'text', text: s(b.text) }); break
      case 'button': out.push({ type: 'button', label: s(b.label, 80), url: s(b.url, 2000) }); break
      case 'image': out.push({ type: 'image', url: s(b.url, 2000), alt: s(b.alt, 300), ...(b.href ? { href: s(b.href, 2000) } : {}) }); break
      case 'divider': out.push({ type: 'divider' }); break
      case 'spacer': out.push({ type: 'spacer', height: typeof b.height === 'number' ? b.height : 16 }); break
      case 'rewards': out.push({ type: 'rewards' }); break
      case 'order_items': out.push({ type: 'order_items' }); break
    }
  }
  return out
}
