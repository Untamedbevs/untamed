import type { BlastFilters } from '@/lib/crm/blast-filters'

const AUDIENCES = new Set(['loyalty', 'referrers', 'distributors', 'all', 'staff'])

/** Validate a saved-segment filters payload. Returns null if unusable. */
export function parseSegmentFilters(raw: unknown): BlastFilters | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>
  if (typeof f.audience !== 'string' || !AUDIENCES.has(f.audience)) return null
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null || v === '') continue
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') clean[k] = v
  }
  return clean as unknown as BlastFilters
}
