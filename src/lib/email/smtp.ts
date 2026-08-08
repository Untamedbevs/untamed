/**
 * Google Workspace SMTP Email Client
 *
 * Low-level wrapper around nodemailer for sending emails through Google
 * Workspace. Defaults to the SMTP relay service (`smtp-relay.gmail.com`),
 * which allows sending from any alias on the domain and has higher daily
 * limits than plain `smtp.gmail.com`.
 *
 * Required env:
 *   GOOGLE_SMTP_USER          Workspace account used for SMTP AUTH
 *   GOOGLE_SMTP_APP_PASSWORD  App password for that account
 * Optional env:
 *   GOOGLE_SMTP_HOST          defaults to smtp-relay.gmail.com
 *   GOOGLE_SMTP_PORT          defaults to 587 (STARTTLS)
 *   SMTP_FROM_EMAIL           default From address
 */

import nodemailer, { type Transporter } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

// ---------------------------------------------------------------------------
// Transporter singleton
// ---------------------------------------------------------------------------

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (!transporter) {
    const user = process.env.GOOGLE_SMTP_USER
    const pass = process.env.GOOGLE_SMTP_APP_PASSWORD
    if (!user || !pass) {
      throw new Error(
        'Missing GOOGLE_SMTP_USER / GOOGLE_SMTP_APP_PASSWORD env vars for SMTP email'
      )
    }

    const port = parseInt(process.env.GOOGLE_SMTP_PORT || '587', 10)

    // No connection pooling: serverless invocations freeze idle sockets,
    // so a fresh connection per send is more reliable.
    const options: SMTPTransport.Options = {
      host: process.env.GOOGLE_SMTP_HOST || 'smtp-relay.gmail.com',
      port,
      secure: port === 465,
      requireTLS: true,
      auth: { user, pass },
    }
    transporter = nodemailer.createTransport(options)
  }
  return transporter
}

// ---------------------------------------------------------------------------
// Email Aliases
// ---------------------------------------------------------------------------

export type EmailAlias = 'support' | 'loyalty' | 'orders'

const ALIAS_MAP: Record<EmailAlias, string> = {
  support: 'support@untamedbeverages.com',
  loyalty: 'loyalty@untamedbeverages.com',
  orders: 'orders@untamedbeverages.com',
}

const FROM_NAME = 'Untamed Beverages'

const DEFAULT_FROM = () =>
  process.env.SMTP_FROM_EMAIL || process.env.SES_FROM_EMAIL || ALIAS_MAP.support

export function resolveAlias(alias?: EmailAlias | string): string {
  if (!alias) return DEFAULT_FROM()
  return ALIAS_MAP[alias as EmailAlias] || alias
}

function formatFromAddress(address: string): string {
  return `${FROM_NAME} <${address}>`
}

// ---------------------------------------------------------------------------
// Retry logic for transient SMTP errors
// ---------------------------------------------------------------------------

// 4xx SMTP codes are transient ("try again later"); 5xx are permanent.
const RETRYABLE_SMTP_CODES = new Set([421, 450, 451, 452, 454])
const RETRYABLE_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNECTION',
  'ECONNRESET',
  'ESOCKET',
  'EDNS',
])

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

function isRetryable(err: unknown): boolean {
  const e = err as { responseCode?: number; code?: string }
  if (e?.responseCode && RETRYABLE_SMTP_CODES.has(e.responseCode)) return true
  if (e?.code && RETRYABLE_ERROR_CODES.has(e.code)) return true
  return false
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastError = err
      if (attempt < MAX_RETRIES && isRetryable(err)) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt)
        const code =
          (err as { responseCode?: number }).responseCode ||
          (err as { code?: string }).code
        console.warn(
          `[SMTP] Retryable error (${code}), attempt ${attempt + 1}/${MAX_RETRIES}, waiting ${delay}ms`
        )
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }
  throw lastError
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  cc?: string | string[]
  /** Custom MIME headers, e.g. `List-Unsubscribe` / `List-Unsubscribe-Post`. */
  headers?: Record<string, string>
}

export interface EmailAttachment {
  /** Public URL to fetch the file content from (S3/CDN) */
  url: string
  filename: string
  contentType: string
}

export interface SendRawEmailParams extends SendEmailParams {
  attachments: EmailAttachment[]
}

interface NodemailerAttachment {
  filename: string
  content: Buffer
  contentType: string
}

async function send(
  params: SendEmailParams,
  attachments: NodemailerAttachment[] = []
): Promise<string> {
  const { to, subject, html, text, from, replyTo, cc, headers } = params
  const toAddresses = Array.isArray(to) ? to : [to]
  const ccAddresses = cc ? (Array.isArray(cc) ? cc : [cc]).filter(Boolean) : []
  const fromAddress = from || DEFAULT_FROM()

  const info = await withRetry(() =>
    getTransporter().sendMail({
      from: formatFromAddress(fromAddress),
      to: toAddresses.join(', '),
      ...(ccAddresses.length > 0 ? { cc: ccAddresses.join(', ') } : {}),
      replyTo: replyTo || fromAddress,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
      ...(headers && Object.keys(headers).length > 0 ? { headers } : {}),
    })
  )

  // nodemailer returns "<id@domain>"; strip the angle brackets for storage
  return (info.messageId || 'unknown').replace(/^<|>$/g, '')
}

/**
 * Send an email via Google Workspace SMTP.
 * Returns the message ID on success.
 */
export async function sendEmail(params: SendEmailParams): Promise<string> {
  return send(params)
}

/**
 * Send an email with attachments. Attachment content is fetched from the
 * provided public URLs (S3/CDN) before sending.
 */
export async function sendRawEmail(params: SendRawEmailParams): Promise<string> {
  const attachmentParts = await Promise.all(
    params.attachments.map(async (att) => {
      const res = await fetch(att.url)
      if (!res.ok) throw new Error(`Failed to fetch attachment: ${att.filename} (${res.status})`)
      const buffer = Buffer.from(await res.arrayBuffer())
      return {
        filename: att.filename,
        content: buffer,
        contentType: att.contentType,
      }
    })
  )

  return send(params, attachmentParts)
}
