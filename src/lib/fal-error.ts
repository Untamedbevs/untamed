import { ApiError, ValidationError } from '@fal-ai/client'

/**
 * Fal 422 responses often set message to the HTTP status text ("Unprocessable Entity").
 * Prefer body.detail / field errors so operators see the real validation reason.
 */
export function formatFalClientError(e: unknown): string {
  if (e instanceof ValidationError) {
    const bits: string[] = []
    if (e.requestId) bits.push(`fal_request=${e.requestId}`)
    const fields = e.fieldErrors
    if (fields.length) {
      for (const fe of fields) {
        const loc = Array.isArray(fe.loc) ? fe.loc.join('.') : 'input'
        bits.push(`${loc}: ${fe.msg}`)
      }
    } else if (e.body && typeof e.body === 'object' && 'detail' in e.body) {
      const d = (e.body as { detail: unknown }).detail
      bits.push(typeof d === 'string' ? d : JSON.stringify(d))
    }
    if (bits.length) return bits.join(' | ')
    return e.message || 'Validation failed'
  }
  if (e instanceof ApiError) {
    const bits: string[] = []
    if (e.requestId) bits.push(`fal_request=${e.requestId}`)
    if (e.body && typeof e.body === 'object') {
      const b = e.body as Record<string, unknown>
      if (typeof b.message === 'string' && b.message && b.message !== 'Unprocessable Entity') {
        bits.push(b.message)
      }
      if (b.detail !== undefined) {
        bits.push(typeof b.detail === 'string' ? b.detail : JSON.stringify(b.detail))
      }
    }
    if (bits.length) return bits.join(' | ')
    return e.message || 'Fal request failed'
  }
  if (e instanceof Error) return e.message
  return 'Unknown error'
}
