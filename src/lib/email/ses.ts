/**
 * AWS SES Email Client
 *
 * Low-level wrapper around AWS SES for sending emails.
 * Reuses AWS credentials from env (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
 * `AWS_REGION`).
 */

import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses'
import MailComposer from 'nodemailer/lib/mail-composer'

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let sesClient: SESClient | null = null

function getClient(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  }
  return sesClient
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

const DEFAULT_FROM = () => process.env.SES_FROM_EMAIL || ALIAS_MAP.support

export function resolveAlias(alias?: EmailAlias | string): string {
  if (!alias) return DEFAULT_FROM()
  return ALIAS_MAP[alias as EmailAlias] || alias
}

function formatFromAddress(address: string): string {
  return `${FROM_NAME} <${address}>`
}

// ---------------------------------------------------------------------------
// Retry logic for transient SES errors
// ---------------------------------------------------------------------------

const RETRYABLE_ERROR_CODES = new Set([
  'Throttling',
  'TooManyRequestsException',
  'ServiceUnavailableException',
  'RequestLimitExceeded',
])

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastError = err
      const code = (err as { name?: string })?.name || (err as { Code?: string })?.Code || ''
      if (attempt < MAX_RETRIES && RETRYABLE_ERROR_CODES.has(code)) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt)
        console.warn(`[SES] Retryable error (${code}), attempt ${attempt + 1}/${MAX_RETRIES}, waiting ${delay}ms`)
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
}

/**
 * Send an email via AWS SES.
 * Returns the SES message ID on success.
 */
export async function sendEmail(params: SendEmailParams): Promise<string> {
  const { to, subject, html, text, from, replyTo, cc } = params
  const toAddresses = Array.isArray(to) ? to : [to]
  const ccAddresses = cc ? (Array.isArray(cc) ? cc : [cc]).filter(Boolean) : []
  const fromAddress = from || DEFAULT_FROM()

  const configSetName = process.env.SES_CONFIGURATION_SET

  const body: Record<string, { Data: string; Charset: string }> = {
    Html: { Data: html, Charset: 'UTF-8' },
  }
  if (text) {
    body.Text = { Data: text, Charset: 'UTF-8' }
  }

  const command = new SendEmailCommand({
    Source: formatFromAddress(fromAddress),
    Destination: {
      ToAddresses: toAddresses,
      ...(ccAddresses.length > 0 ? { CcAddresses: ccAddresses } : {}),
    },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: body,
    },
    ReplyToAddresses: replyTo ? [replyTo] : [fromAddress],
    ...(configSetName ? { ConfigurationSetName: configSetName } : {}),
  })

  const response = await withRetry(() => getClient().send(command))
  return response.MessageId || 'unknown'
}

// ---------------------------------------------------------------------------
// Raw Email (MIME multipart -- required for attachments)
// ---------------------------------------------------------------------------

export interface EmailAttachment {
  /** Public URL to fetch the file content from (S3/CDN) */
  url: string
  filename: string
  contentType: string
}

export interface SendRawEmailParams extends SendEmailParams {
  attachments: EmailAttachment[]
}

/**
 * Send an email with attachments via SES SendRawEmail.
 * Uses nodemailer's MailComposer to build a valid MIME message.
 */
export async function sendRawEmail(params: SendRawEmailParams): Promise<string> {
  const { to, subject, html, text, from, replyTo, cc, attachments } = params
  const toAddresses = Array.isArray(to) ? to : [to]
  const ccAddresses = cc ? (Array.isArray(cc) ? cc : [cc]).filter(Boolean) : []
  const fromAddress = from || DEFAULT_FROM()
  const configSetName = process.env.SES_CONFIGURATION_SET

  const attachmentParts = await Promise.all(
    attachments.map(async (att) => {
      const res = await fetch(att.url)
      if (!res.ok) throw new Error(`Failed to fetch attachment: ${att.filename} (${res.status})`)
      const buffer = Buffer.from(await res.arrayBuffer())
      return {
        filename: att.filename,
        content: buffer,
        contentType: att.contentType,
      }
    }),
  )

  const mail = new MailComposer({
    from: formatFromAddress(fromAddress),
    to: toAddresses.join(', '),
    ...(ccAddresses.length > 0 ? { cc: ccAddresses.join(', ') } : {}),
    replyTo: replyTo || fromAddress,
    subject,
    html,
    ...(text ? { text } : {}),
    attachments: attachmentParts,
    headers: configSetName
      ? { 'X-SES-CONFIGURATION-SET': configSetName }
      : undefined,
  })

  const mimeBuffer = await mail.compile().build()

  const command = new SendRawEmailCommand({
    RawMessage: { Data: mimeBuffer },
  })

  const response = await withRetry(() => getClient().send(command))
  return response.MessageId || 'unknown'
}
