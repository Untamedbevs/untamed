/**
 * Parsing helpers for Gmail messages: addresses, bodies, quoted-reply
 * stripping, and "please stop emailing me" detection. Pure functions.
 */

import { decodeBase64url, type GmailMessagePart } from '@/lib/gmail/client'

export const BODY_MAX_CHARS = 20_000

const EMAIL_RE = /[A-Z0-9._%+'-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi
const VALID_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function normalizeEmail(value: string | null | undefined): string | null {
  const v = (value || '').trim().toLowerCase()
  return VALID_EMAIL_RE.test(v) ? v : null
}

/** Every address-looking string in a piece of text (lowercased, unique). */
export function extractEmails(text: string | null | undefined): string[] {
  return [...new Set((text || '').match(EMAIL_RE)?.map((e) => e.toLowerCase()) || [])]
}

/** Split an address-list header on commas that aren't inside quotes or <>. */
function splitAddressList(value: string): string[] {
  const out: string[] = []
  let current = ''
  let inQuotes = false
  let inAngle = false
  for (const ch of value) {
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === '<' && !inQuotes) inAngle = true
    else if (ch === '>' && !inQuotes) inAngle = false
    if (ch === ',' && !inQuotes && !inAngle) {
      out.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) out.push(current)
  return out
}

/** The address of one mailbox (`"Jane" <jane@x.com>` or `jane@x.com`). */
export function parseMailbox(value: string | null | undefined): string | null {
  if (!value) return null
  const angle = value.match(/<([^<>]+)>\s*$/)
  if (angle) return normalizeEmail(angle[1])
  return normalizeEmail(extractEmails(value)[0])
}

export function parseAddressList(value: string | null | undefined): string[] {
  if (!value) return []
  return [...new Set(splitAddressList(value).map(parseMailbox).filter((e): e is string => !!e))]
}

/** `<id@host>` form, or null when it isn't a plausible Message-ID. */
export function normalizeMessageId(value: string | null | undefined): string | null {
  const v = (value || '').trim()
  if (!v) return null
  const inner = v.replace(/^<|>$/g, '').trim()
  if (!inner || /[\s<>]/.test(inner) || inner.length > 500) return null
  return `<${inner}>`
}

/** The first Message-ID in a References / In-Reply-To header. */
export function firstMessageId(value: string | null | undefined): string | null {
  const m = (value || '').match(/<[^<>\s]+>/)
  return m ? m[0] : normalizeMessageId(value)
}

// ---------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------

function charsetOf(part: GmailMessagePart): string {
  const ct = (part.headers || []).find((h) => h.name.toLowerCase() === 'content-type')?.value || ''
  return (ct.match(/charset="?([^";\s]+)"?/i)?.[1] || 'utf-8').toLowerCase()
}

function decodePart(part: GmailMessagePart): string {
  if (!part.body?.data) return ''
  const bytes = decodeBase64url(part.body.data)
  const charset = charsetOf(part)
  if (charset === 'utf-8' || charset === 'utf8' || charset === 'us-ascii') return bytes.toString('utf8')
  try {
    return new TextDecoder(charset).decode(bytes)
  } catch {
    return bytes.toString('utf8')
  }
}

function isAttachment(part: GmailMessagePart): boolean {
  if (part.filename) return true
  const disposition = (part.headers || []).find((h) => h.name.toLowerCase() === 'content-disposition')?.value || ''
  return /^\s*attachment/i.test(disposition)
}

function findPart(part: GmailMessagePart | undefined, mimeType: string): GmailMessagePart | null {
  if (!part) return null
  if ((part.mimeType || '').toLowerCase() === mimeType && !isAttachment(part) && part.body?.data) return part
  for (const child of part.parts || []) {
    const found = findPart(child, mimeType)
    if (found) return found
  }
  return null
}

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+|#39);/gi, (m, code: string) => {
      const lower = code.toLowerCase()
      if (ENTITIES[lower]) return ENTITIES[lower]
      if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16) || 32)
      if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10) || 32)
      return m
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Cut an HTML reply at the start of the quoted original. */
function stripQuotedHtml(html: string): string {
  const markers = [/<blockquote/i, /class="?gmail_quote/i, /id="?divRplyFwdMsg/i, /id="?appendonsend/i, /class="?yahoo_quoted/i]
  let cut = html.length
  for (const re of markers) {
    const m = re.exec(html)
    // Cut at the start of the tag the marker sits in.
    if (m) cut = Math.min(cut, Math.max(0, html.lastIndexOf('<', m.index)))
  }
  return html.slice(0, cut)
}

export interface MessageBody {
  /** Text stored in the log (plain part, or stripped HTML), truncated. */
  text: string
  /** Only what the sender wrote in this message, without the quoted thread. */
  newText: string
}

export function extractBody(payload: GmailMessagePart | undefined): MessageBody {
  const plain = findPart(payload, 'text/plain')
  if (plain) {
    const text = decodePart(plain)
    return { text: text.slice(0, BODY_MAX_CHARS), newText: newReplyText(text) }
  }
  const htmlPart = findPart(payload, 'text/html')
  if (htmlPart) {
    const html = decodePart(htmlPart)
    return {
      text: htmlToText(html).slice(0, BODY_MAX_CHARS),
      newText: newReplyText(htmlToText(stripQuotedHtml(html))),
    }
  }
  return { text: '', newText: '' }
}

/**
 * The part of a plain-text reply the sender wrote: stops at the quoted
 * original ("On ... wrote:", Outlook headers, "-----Original Message-----")
 * and drops `>` lines. Our outreach footer mentions "unsubscribe", so it must
 * never count as the person's own words.
 */
export function newReplyText(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t.startsWith('>')) continue
    if (/^On\b.*\bwrote:?$/i.test(t)) break
    if (/^On\b/i.test(t) && i + 1 < lines.length && /\bwrote:?$/i.test(lines[i + 1].trim())) break
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(t)) break
    if (/^_{8,}$/.test(t)) break
    if (/^From:\s/i.test(t) && lines.slice(i + 1, i + 5).some((l) => /^(Sent|Date|To|Subject):\s/i.test(l.trim()))) break
    if (/^--\s?$/.test(lines[i])) break
    if (/won.t email you again/i.test(t)) continue
    out.push(lines[i])
  }
  return out.join('\n').trim().slice(0, 5000)
}

const STOP_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bopt (?:me|us) out\b/i,
  /\bopt(?:ing)?[\s-]?out of (?:your |these |this |the |all )?(?:emails?|e-mails?|lists?|mailings?|newsletters?|marketing)\b/i,
  /^\s*opt[\s-]?out\s*[.!]*\s*$/im,
  /\btake me off\b/i,
  /\bremove me from\b[^.\n]{0,40}\b(?:list|lists|emails?|e-mails?|mailings?|newsletters?|sequence|database)\b/i,
  /^\s*remove me\s*[.!]*\s*$/im,
  /\bstop (?:emailing|e-mailing|mailing|contacting|messaging)\b/i,
  /\bstop sending (?:me|us)\b/i,
  /\b(?:do not|don['’]?t|please don['’]?t) (?:email|e-mail|contact|message) (?:me|us)\b/i,
  /\bno more emails\b/i,
]

/** Does this reply ask us to stop emailing? Checks only the person's own words. */
export function isStopRequest(subject: string | null | undefined, newText: string): boolean {
  const cleanSubject = (subject || '').replace(/^\s*((re|fwd?|aw|sv)\s*:\s*)+/i, '')
  return STOP_PATTERNS.some((re) => re.test(newText) || re.test(cleanSubject))
}

/** Bounce notices and auto-replies, which aren't a person writing to us. */
export function isAutomatedSender(from: string | null, autoSubmitted: string | null): boolean {
  if (autoSubmitted && autoSubmitted.trim().toLowerCase() !== 'no') return true
  if (!from) return false
  return /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply)@/i.test(from)
}

export function isBounceSender(from: string | null): boolean {
  return !!from && /^(mailer-daemon|postmaster)@/i.test(from)
}
