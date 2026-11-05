import { CRM_SENDERS } from '@/lib/crm/senders'

const KINDS = new Set(['campaign', 'transactional'])
const AUDIENCES = new Set(['loyalty', 'referrers', 'distributors', 'all'])
const SENDERS = new Set<string>(CRM_SENDERS.map((s) => s.id))

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Validate a create/update payload for email_templates. */
export function parseTemplateInput(
  raw: unknown,
  { requireAll }: { requireAll: boolean }
): { value: Record<string, unknown> } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Invalid body' }
  const b = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}

  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim() : undefined)

  const name = str('name')
  if (name !== undefined) {
    if (!name) return { error: 'Name is required' }
    out.name = name
  } else if (requireAll) return { error: 'Name is required' }

  const slug = str('slug') ?? (requireAll && name ? slugify(name) : undefined)
  if (slug !== undefined) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return { error: 'Slug may only use a-z, 0-9 and dashes' }
    out.slug = slug
  }

  const subject = str('subject')
  if (subject !== undefined) {
    if (!subject) return { error: 'Subject is required' }
    out.subject = subject
  } else if (requireAll) return { error: 'Subject is required' }

  if (typeof b.body === 'string') {
    if (!b.body.trim()) return { error: 'Body is required' }
    out.body = b.body
  } else if (requireAll) return { error: 'Body is required' }

  if (b.kind !== undefined) {
    if (typeof b.kind !== 'string' || !KINDS.has(b.kind)) return { error: 'Invalid kind' }
    out.kind = b.kind
  }
  if (b.preheader !== undefined) out.preheader = str('preheader') || null
  if (b.sender_id !== undefined) {
    const v = str('sender_id') || null
    if (v && !SENDERS.has(v)) return { error: 'Invalid sender' }
    out.sender_id = v
  }
  if (b.default_audience !== undefined) {
    const v = str('default_audience') || null
    if (v && !AUDIENCES.has(v)) return { error: 'Invalid audience' }
    out.default_audience = v
  }
  if (b.is_archived !== undefined) out.is_archived = !!b.is_archived

  return { value: out }
}
