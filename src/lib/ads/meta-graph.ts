const GRAPH_VERSION = 'v26.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

export { GRAPH_VERSION, GRAPH_BASE }

export class MetaGraphError extends Error {
  status: number
  code?: number
  type?: string

  constructor(message: string, status: number, code?: number, type?: string) {
    super(message)
    this.name = 'MetaGraphError'
    this.status = status
    this.code = code
    this.type = type
  }
}

export function getMetaAccessToken(): string | null {
  return process.env.META_ACCESS_TOKEN || process.env.META_CAPI_ACCESS_TOKEN || null
}

export function getMetaAdAccountId(): string | null {
  const id = process.env.META_AD_ACCOUNT_ID
  if (!id) return null
  return id.startsWith('act_') ? id : `act_${id}`
}

export function getMetaPixelId(): string | null {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.META_PIXEL_ID || null
}

export function getMetaPageId(): string | null {
  return process.env.META_FB_PAGE_ID || null
}

export function isMetaAdsConfigured(): boolean {
  return Boolean(getMetaAccessToken() && getMetaAdAccountId())
}

export function requireMetaAccessToken(): string {
  const token = getMetaAccessToken()
  if (!token) throw new Error('META_ACCESS_TOKEN is not set')
  return token
}

export function requireMetaAdAccountId(): string {
  const id = getMetaAdAccountId()
  if (!id) throw new Error('META_AD_ACCOUNT_ID is not set')
  return id
}

export function getMetaAdsConfigStatus() {
  const token = getMetaAccessToken()
  const accountId = getMetaAdAccountId()
  const pixelId = getMetaPixelId()
  const pageId = getMetaPageId()
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN || null
  const igUserId = process.env.META_IG_USER_ID || null

  return {
    configured: Boolean(token && accountId),
    tokenSet: Boolean(token),
    tokenHint: token ? `…${token.slice(-4)}` : null,
    adAccountId: accountId,
    pixelId,
    pageId,
    pageTokenSet: Boolean(pageToken),
    igUserId,
    capiTokenSet: Boolean(process.env.META_CAPI_ACCESS_TOKEN || token),
    graphVersion: GRAPH_VERSION,
  }
}

interface GraphErrorBody {
  error?: { message?: string; code?: number; type?: string; error_subcode?: number }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: { message: text } }
  }
}

function throwIfError(res: Response, body: unknown): void {
  if (res.ok) return
  const err = (body as GraphErrorBody).error
  throw new MetaGraphError(
    err?.message || `Meta Graph error: HTTP ${res.status}`,
    res.status,
    err?.code,
    err?.type
  )
}

export async function metaGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${path.replace(/^\//, '')}`)
  url.searchParams.set('access_token', requireMetaAccessToken())
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const res = await fetch(url.toString(), { cache: 'no-store' })
  const body = await parseBody(res)
  throwIfError(res, body)
  return body as T
}

export async function metaPost<T>(path: string, data: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}/${path.replace(/^\//, '')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, access_token: requireMetaAccessToken() }),
  })
  const body = await parseBody(res)
  throwIfError(res, body)
  return body as T
}

export interface MetaPaginated<T> {
  data: T[]
  paging?: { next?: string; cursors?: { after?: string } }
}

export async function metaGetAll<T>(
  path: string,
  params: Record<string, string> = {},
  maxPages = 10
): Promise<T[]> {
  const rows: T[] = []
  let page = 0
  let result = await metaGet<MetaPaginated<T>>(path, { ...params, limit: params.limit || '100' })
  rows.push(...(result.data || []))

  while (result.paging?.next && page < maxPages - 1) {
    const res = await fetch(result.paging.next, { cache: 'no-store' })
    const body = await parseBody(res)
    throwIfError(res, body)
    result = body as MetaPaginated<T>
    rows.push(...(result.data || []))
    page += 1
  }

  return rows
}
