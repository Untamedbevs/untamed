/**
 * Pre-send content checks for campaigns and flow steps.
 *
 * Errors block sending; warnings are shown for a human to judge. Covers
 * deliverability (subject, size, links, images) and alcohol-marketing basics
 * (no health claims, nothing aimed at under-21s). These are guardrails, not
 * legal review.
 */

import { KNOWN_TAG_NAMES, unknownTags, type EmailBlock } from '@/lib/email/blocks'

export interface CheckResult {
  errors: string[]
  warnings: string[]
}

const SPAM_PHRASES = [
  'act now', '100% free', 'risk-free', 'risk free', 'guaranteed', 'no obligation',
  'click here', 'winner', 'cash bonus', 'urgent', 'limited time only', 'once in a lifetime',
  '$$$', 'buy now!!!',
]

// TTB and the industry codes prohibit health/therapeutic claims and appeals to minors.
const HEALTH_CLAIMS = [
  'healthy', 'health benefit', 'cure', 'cures', 'heal', 'boost your immune', 'immune',
  'medicinal', 'therapeutic', 'detox', 'reduces stress', 'good for you', 'hangover-free',
  'hangover free', 'weight loss',
]
const UNDERAGE = ['kids', 'kid', 'teen', 'teens', 'teenager', 'high school', 'underage', 'minors', 'back to school']

/** Gmail clips messages over ~102 KB. */
const GMAIL_CLIP_BYTES = 102 * 1024

function words(text: string, list: string[]): string[] {
  const lower = ` ${text.toLowerCase()} `
  return list.filter((w) => new RegExp(`[^a-z]${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^a-z]`).test(lower))
}

export function blocksToPlainText(blocks: EmailBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
        case 'text':
          return b.text
        case 'button':
          return b.label
        case 'image':
          return b.alt
        default:
          return ''
      }
    })
    .filter(Boolean)
    .join('\n')
}

export function checkEmailContent(params: {
  subject: string
  preheader?: string | null
  blocks: EmailBlock[]
  renderedHtml?: string
  kind?: 'marketing' | 'transactional'
  extraTagNames?: string[]
}): CheckResult {
  const errors: string[] = []
  const warnings: string[] = []
  const subject = params.subject.trim()
  const bodyText = blocksToPlainText(params.blocks)
  const allText = `${subject}\n${params.preheader || ''}\n${bodyText}`
  const known = [...KNOWN_TAG_NAMES, ...(params.extraTagNames || [])]

  // Subject
  if (!subject) errors.push('Subject is empty.')
  if (subject.length > 90) warnings.push(`Subject is ${subject.length} characters; most inboxes cut off around 60–70.`)
  const letters = subject.replace(/[^A-Za-z]/g, '')
  if (letters.length >= 8 && letters === letters.toUpperCase()) warnings.push('Subject is all capitals, which reads as spam.')
  if ((subject.match(/!/g) || []).length > 1) warnings.push('Subject has more than one exclamation mark.')
  if (/^(re|fwd?)\s*:/i.test(subject)) errors.push('Subject pretends to be a reply or forward (deceptive under CAN-SPAM).')
  if (params.kind !== 'transactional' && !params.preheader?.trim()) warnings.push('No preheader: inboxes will show the first line of the body instead.')

  // Body
  if (params.blocks.length === 0) errors.push('The email has no content.')
  if (bodyText.trim().length < 20 && params.blocks.some((b) => b.type === 'image')) {
    warnings.push('Mostly images with little text; image-only emails are often filtered as spam.')
  }
  for (const b of params.blocks) {
    if (b.type === 'image' && !b.alt?.trim()) warnings.push('An image has no alt text.')
    if (b.type === 'button' && (!b.url?.trim() || !b.label?.trim())) errors.push('A button is missing its label or link.')
    if ((b.type === 'button' && b.url?.startsWith('http://')) || (b.type === 'image' && b.url?.startsWith('http://'))) {
      warnings.push('A link or image uses http:// instead of https://.')
    }
  }
  const links = params.blocks.filter((b) => b.type === 'button' || (b.type === 'image' && b.href)).length
    + (bodyText.match(/\]\(https?:/g) || []).length
  if (links > 20) warnings.push(`${links} links; keep it under 20.`)

  // Merge tags
  const unknown = unknownTags(allText, known)
  if (unknown.length) errors.push(`Unknown merge tag${unknown.length > 1 ? 's' : ''}: ${unknown.map((t) => `{{${t}}}`).join(', ')}.`)
  const leftover = allText.replace(/\{\{[^{}]*\}\}/g, '')
  if (leftover.includes('{{') || leftover.includes('}}')) errors.push('A merge tag is missing a brace.')

  // Spam phrasing
  const spam = words(allText, SPAM_PHRASES)
  if (spam.length) warnings.push(`Spam-filter phrases: ${spam.join(', ')}.`)
  if ((bodyText.match(/!/g) || []).length > 6) warnings.push('Lots of exclamation marks in the body.')

  // Alcohol marketing basics
  const health = words(allText, HEALTH_CLAIMS)
  if (health.length) errors.push(`Possible health claim (not allowed in alcohol ads): ${health.join(', ')}.`)
  const minors = words(allText, UNDERAGE)
  if (minors.length) errors.push(`Wording that could appeal to under-21s: ${minors.join(', ')}.`)

  // Size
  if (params.renderedHtml) {
    const bytes = new TextEncoder().encode(params.renderedHtml).length
    if (bytes > GMAIL_CLIP_BYTES) warnings.push(`HTML is ${Math.round(bytes / 1024)} KB; Gmail clips messages over 102 KB (hiding the unsubscribe link).`)
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}
