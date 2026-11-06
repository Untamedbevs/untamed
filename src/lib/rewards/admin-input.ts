import { z } from 'zod'
import { isArtKey } from './art'
import { PROOF_MODES, REWARD_KINDS, type Promotion } from './catalog'

/**
 * Input checks for the staff rewards admin: reward items, milestones and
 * promotions. Each parser returns the columns to write. Creating needs the
 * required fields; updating accepts any subset and leaves the rest alone.
 */

export type Parsed<T> = { ok: true; values: T } | { ok: false; error: string }

const typeError = (label: string, kind: string) => ({
  error: (issue: { input?: unknown }) => (issue.input === undefined ? `${label} is required` : `${label} must be ${kind}`),
})

function parse<T extends z.ZodType>(schema: T, body: unknown): Parsed<z.output<T>> {
  const parsed = schema.safeParse(body)
  if (parsed.success) return { ok: true, values: parsed.data }
  return { ok: false, error: parsed.error.issues[0]?.message || 'Invalid input' }
}

const name = (label: string) =>
  z
    .string(typeError(label, 'text'))
    .trim()
    .min(1, `${label} is required`)
    .max(120, `${label} must be 120 characters or fewer`)

/** Optional free text: trimmed, and empty becomes null. */
const note = (label: string, max: number) =>
  z
    .string(typeError(label, 'text'))
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .nullable()
    .transform((v) => v || null)

const points = z
  .number(typeError('Points', 'a number'))
  .int('Points must be a whole number')
  .min(1, 'Points must be at least 1')
  .max(1_000_000, 'Points can be at most 1,000,000')

const icon = z
  .string(typeError('Icon', 'text'))
  .nullable()
  .refine((v) => v === null || isArtKey(v), 'Pick an icon from the art list')

const active = z.boolean(typeError('Active', 'true or false'))

// ---------------------------------------------------------------------------
// Reward items
// ---------------------------------------------------------------------------

const rewardItemFields = z.object({
  name: name('Name'),
  kind: z.enum(
    REWARD_KINDS.map((k) => k.value),
    'Pick a reward kind'
  ),
  value_cents: z
    .number(typeError('Value', 'a number'))
    .int('Value must be in whole cents')
    .min(0, 'Value can’t be negative')
    .max(10_000_000, 'Value can be at most $100,000'),
  description: note('Description', 1000).optional(),
  icon: icon.optional(),
  fulfillment_note: note('Fulfillment note', 2000).optional(),
  is_active: active.optional(),
})

export function parseRewardItem(body: unknown, mode: 'create' | 'update') {
  return parse(mode === 'create' ? rewardItemFields : rewardItemFields.partial(), body)
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

const milestoneFields = z.object({
  points,
  title: name('Title'),
  tagline: note('Tagline', 200).optional(),
  icon: icon.optional(),
  reward_id: z.uuid('Pick a reward from the list').nullable().optional(),
  is_active: active.optional(),
})

export function parseMilestone(body: unknown, mode: 'create' | 'update') {
  return parse(mode === 'create' ? milestoneFields : milestoneFields.partial(), body)
}

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------

/** Lowercase, non-alphanumerics to hyphens, at most 60 characters. */
function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}

const HOSTNAME = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/

/** "https://www.Facebook.com/page" → "www.facebook.com" */
const hostname = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#:].*$/, '')

const list = (label: string) =>
  z
    .array(z.string(typeError(`Each ${label.toLowerCase()} item`, 'text')), typeError(label, 'a list'))
    .transform((items) => items.map((s) => s.trim()).filter(Boolean))
    .pipe(
      z
        .array(z.string().max(200, `${label} items must be 200 characters or fewer`))
        .max(12, `${label} can have up to 12 items`)
    )

const hosts = z
  .array(z.string(typeError('Each allowed link host', 'text')), typeError('Allowed link hosts', 'a list'))
  .transform((items) => [...new Set(items.map(hostname).filter(Boolean))])
  .pipe(
    z
      .array(z.string().regex(HOSTNAME, 'Allowed link hosts must be hostnames like facebook.com'))
      .max(10, 'Up to 10 allowed link hosts')
  )

const date = (label: string) =>
  z
    .string(typeError(label, 'a date'))
    .nullable()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), `${label} must be a valid date`)
    .transform((v) => (v ? new Date(v).toISOString() : null))

const proofMode = (label: string) => z.enum(PROOF_MODES, `${label} must be off, optional or required`)

const promotionFields = z.object({
  title: name('Title'),
  // Normalized (or derived from the title) in parsePromotion.
  slug: z.string(typeError('Slug', 'text')).optional(),
  summary: note('Summary', 300).optional(),
  instructions: note('Instructions', 4000).optional(),
  requirements: list('Member rules').optional(),
  review_checklist: list('Reviewer checklist').optional(),
  // Same ceiling the review queue allows when approving.
  points: points.max(100_000, 'A Hunt can be worth at most 100,000 points'),
  url_mode: proofMode('Link proof'),
  image_mode: proofMode('Screenshot proof'),
  text_mode: proofMode('Note proof'),
  url_hosts: hosts.optional(),
  url_label: note('Link label', 80).optional(),
  icon: icon.optional(),
  starts_at: date('Start').optional(),
  ends_at: date('End').optional(),
  max_per_member: z
    .number(typeError('Max per member', 'a number'))
    .int('Max per member must be a whole number')
    .min(1, 'Max per member must be at least 1')
    .max(100, 'Max per member can be at most 100')
    .optional(),
  is_active: active.optional(),
})

/**
 * Pass `existing` when updating: the rules that span fields (at least one kind
 * of proof, end after start) are checked against the row as it will be saved.
 */
export function parsePromotion(
  body: unknown,
  existing?: Promotion
): Parsed<Partial<z.output<typeof promotionFields>>> {
  const parsed = parse(existing ? promotionFields.partial() : promotionFields, body)
  if (!parsed.ok) return parsed
  const values = parsed.values

  if (!existing || values.slug !== undefined) {
    values.slug = slugify(values.slug || values.title || existing?.title || '')
    if (!values.slug) return { ok: false, error: 'Add a slug with letters or numbers' }
  }

  const modes = [
    values.url_mode ?? existing?.url_mode,
    values.image_mode ?? existing?.image_mode,
    values.text_mode ?? existing?.text_mode,
  ]
  if (modes.every((m) => m === 'off')) {
    return { ok: false, error: 'Turn on at least one kind of proof: link, screenshot or note' }
  }

  const startsAt = values.starts_at === undefined ? existing?.starts_at : values.starts_at
  const endsAt = values.ends_at === undefined ? existing?.ends_at : values.ends_at
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    return { ok: false, error: 'The end must be after the start' }
  }

  return parsed
}
