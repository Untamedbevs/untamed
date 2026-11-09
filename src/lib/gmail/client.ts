/**
 * Gmail REST API client using a Google Workspace service account with
 * domain-wide delegation. The service account signs a JWT (RS256) naming the
 * mailbox it acts as (`sub`), trades it for an access token, and calls the
 * Gmail API as that user. No Google SDK: just `crypto` and `fetch`.
 *
 * Env:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL        client_email from the key file
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY  private_key (PEM; `\n`-escaped is fine).
 *                                       The whole key-file JSON also works.
 *
 * Setup (Cloud project, Gmail API, delegation scopes): docs/email/gmail-and-outreach.md
 */

import crypto from 'crypto'

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
/** Refresh this long before Google's stated expiry. */
const TOKEN_SKEW_MS = 60_000
const MAX_ATTEMPTS = 3

export class GmailApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

interface ServiceAccount {
  email: string
  privateKey: string
}

function clean(v: string | undefined): string | undefined {
  return v && v.trim() ? v.trim() : undefined
}

function stripQuotes(v: string): string {
  return /^(['"])[\s\S]*\1$/.test(v) ? v.slice(1, -1) : v
}

function getServiceAccount(): ServiceAccount | null {
  let email = clean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
  let key = clean(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
  if (!key) return null

  key = stripQuotes(key)
  // Someone may paste the whole key file instead of just the key.
  if (key.startsWith('{')) {
    try {
      const json = JSON.parse(key) as { private_key?: string; client_email?: string }
      key = json.private_key || ''
      email = email || json.client_email
    } catch {
      return null
    }
  }
  key = key.replace(/\\n/g, '\n')
  if (!email || !key.includes('PRIVATE KEY')) return null
  return { email, privateKey: key }
}

export function isGmailConfigured(): boolean {
  return getServiceAccount() !== null
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeBase64url(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

// ---------------------------------------------------------------------------
// Access tokens (cached per mailbox + scope until shortly before expiry)
// ---------------------------------------------------------------------------

const tokenCache = new Map<string, { token: string; expiresAt: number }>()

function signJwt(account: ServiceAccount, mailbox: string, scope: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({ iss: account.email, sub: mailbox, scope, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  )
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  signer.end()
  return `${header}.${claims}.${base64url(signer.sign(account.privateKey))}`
}

async function getAccessToken(mailbox: string, scope: string, forceRefresh = false): Promise<string> {
  const cacheKey = `${mailbox}|${scope}`
  const cached = tokenCache.get(cacheKey)
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.token

  const account = getServiceAccount()
  if (!account) throw new GmailApiError('Gmail service account is not configured', 0)

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signJwt(account, mailbox, scope),
    }).toString(),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }
  if (!res.ok || !json.access_token) {
    // unauthorized_client: delegation missing for this scope.
    // invalid_grant: the mailbox isn't a user in the Workspace domain.
    const hint =
      json.error === 'unauthorized_client'
        ? ' (domain-wide delegation is missing this scope)'
        : json.error === 'invalid_grant'
          ? ' (is this a real Workspace user, not a group or alias?)'
          : ''
    throw new GmailApiError(
      `Google token request for ${mailbox} failed: ${json.error || res.status}${json.error_description ? ` - ${json.error_description}` : ''}${hint}`,
      res.status
    )
  }

  tokenCache.set(cacheKey, {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in || 3600) * 1000 - TOKEN_SKEW_MS,
  })
  return json.access_token
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

async function gmailRequest<T>(
  mailbox: string,
  scope: string,
  path: string,
  init: { method?: 'GET' | 'POST'; query?: URLSearchParams; body?: unknown } = {}
): Promise<T> {
  const url = `${GMAIL_BASE}${path}${init.query && init.query.toString() ? `?${init.query.toString()}` : ''}`
  let refresh = false

  for (let attempt = 1; ; attempt++) {
    const token = await getAccessToken(mailbox, scope, refresh)
    const res = await fetch(url, {
      method: init.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      cache: 'no-store',
    })
    if (res.ok) return (await res.json()) as T

    const text = await res.text().catch(() => '')
    if (attempt < MAX_ATTEMPTS) {
      if (res.status === 401 && !refresh) {
        refresh = true
        continue
      }
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)))
        continue
      }
    }
    let message = text.slice(0, 300)
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message || message
    } catch {
      // keep the raw text
    }
    throw new GmailApiError(`Gmail ${init.method || 'GET'} ${path.split('?')[0]} for ${mailbox} failed (${res.status}): ${message}`, res.status)
  }
}

export interface GmailMessageRef {
  id: string
  threadId: string
}

export interface GmailHeader {
  name: string
  value: string
}

export interface GmailMessagePart {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: { size?: number; data?: string; attachmentId?: string }
  parts?: GmailMessagePart[]
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  /** Milliseconds since epoch, as a string. */
  internalDate?: string
  payload?: GmailMessagePart
}

/** One page of message ids matching a Gmail search (`q`), newest first. */
export async function listMessages(
  mailbox: string,
  params: { q?: string; pageToken?: string; maxResults?: number } = {}
): Promise<{ messages: GmailMessageRef[]; nextPageToken?: string }> {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.pageToken) query.set('pageToken', params.pageToken)
  query.set('maxResults', String(Math.min(Math.max(params.maxResults || 100, 1), 500)))
  const json = await gmailRequest<{ messages?: GmailMessageRef[]; nextPageToken?: string }>(
    mailbox,
    GMAIL_READONLY_SCOPE,
    '/messages',
    { query }
  )
  return { messages: json.messages || [], nextPageToken: json.nextPageToken }
}

/** A full message (headers + decoded-able body parts). */
export async function getMessage(mailbox: string, id: string): Promise<GmailMessage> {
  return gmailRequest<GmailMessage>(mailbox, GMAIL_READONLY_SCOPE, `/messages/${encodeURIComponent(id)}`, {
    query: new URLSearchParams({ format: 'full' }),
  })
}

/** Headers only (no body), optionally limited to the named headers. */
export async function getMessageMetadata(mailbox: string, id: string, headers: string[] = []): Promise<GmailMessage> {
  const query = new URLSearchParams({ format: 'metadata' })
  for (const h of headers) query.append('metadataHeaders', h)
  return gmailRequest<GmailMessage>(mailbox, GMAIL_READONLY_SCOPE, `/messages/${encodeURIComponent(id)}`, { query })
}

/**
 * Send an RFC 822 message as `mailbox`. It lands in that user's Sent folder.
 * Pass `threadId` (from the same mailbox) to add it to an existing thread;
 * Gmail also needs matching In-Reply-To/References and subject for that.
 */
export async function sendRawMessage(
  mailbox: string,
  rfc822: string,
  threadId?: string | null
): Promise<{ id: string; threadId: string; labelIds?: string[] }> {
  return gmailRequest(mailbox, GMAIL_SEND_SCOPE, '/messages/send', {
    method: 'POST',
    body: { raw: base64url(rfc822), ...(threadId ? { threadId } : {}) },
  })
}

/** A top-level header of a message (case-insensitive name). */
export function getHeader(message: GmailMessage | undefined, name: string): string | null {
  const lower = name.toLowerCase()
  const found = (message?.payload?.headers || []).find((h) => h.name.toLowerCase() === lower)
  return found ? found.value : null
}
