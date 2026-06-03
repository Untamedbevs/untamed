/**
 * Server-side AccelPay REST helpers (orders/sales reconciliation).
 *
 * Requires ACCELPAY_API_TOKEN (Bearer). Brand id and API base are configurable
 * via env so we can point at staging vs production without code changes.
 */

const DEFAULT_API_BASE = 'https://api.accelpay.io'
const DEFAULT_BRAND_ID = '5008728'

export function accelPayConfigured(): boolean {
  return Boolean(process.env.ACCELPAY_API_TOKEN)
}

function apiBase(): string {
  return (process.env.ACCELPAY_API_BASE || DEFAULT_API_BASE).replace(/\/$/, '')
}

export function accelPayBrandId(): string {
  return process.env.ACCELPAY_BRAND_ID || DEFAULT_BRAND_ID
}

/**
 * Fetch recent sales for the brand. `startTime`/`endTime` are UTC unix seconds.
 * Returns the raw sale records (shape per AccelPay; pass each through
 * parseAccelPaySale before crediting).
 */
export async function fetchRecentSales(opts: {
  startTime?: number
  endTime?: number
  saleStatus?: string
  limit?: number
} = {}): Promise<any[]> {
  const token = process.env.ACCELPAY_API_TOKEN
  if (!token) throw new Error('ACCELPAY_API_TOKEN is not set')

  const params = new URLSearchParams()
  if (opts.startTime) params.set('startTime', String(opts.startTime))
  if (opts.endTime) params.set('endTime', String(opts.endTime))
  if (opts.saleStatus) params.set('saleStatus', opts.saleStatus)
  params.set('limit', String(opts.limit ?? 150))

  const url = `${apiBase()}/v1/brands/${accelPayBrandId()}/sales?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AccelPay sales fetch failed (${res.status}): ${text.slice(0, 300)}`)
  }

  const data = await res.json().catch(() => null)
  // Be liberal about the envelope: array, {sales}, {data}, or {results}.
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.sales)) return data.sales
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.results)) return data.results
  return []
}
