/**
 * Outbound email transport: Google Workspace SMTP or Amazon SES.
 *
 * Every send names a stream. Transactional mail (sign-in links, receipts,
 * lead notifications) uses EMAIL_TRANSPORT (Google Workspace until SES is
 * live). Marketing always uses SES unless EMAIL_ALLOW_SMTP_MARKETING is set,
 * so bounces and complaints reach the SES webhook and bulk sending doesn't
 * share Google Workspace's limits. See `src/lib/email/config.ts` for env.
 *
 * SMTP env:
 *   GOOGLE_SMTP_USER          Workspace account used for SMTP AUTH
 *   GOOGLE_SMTP_APP_PASSWORD  App password for that account
 *   GOOGLE_SMTP_HOST          defaults to smtp-relay.gmail.com
 *   GOOGLE_SMTP_PORT          defaults to 587 (STARTTLS)
 *   SMTP_FROM_EMAIL           default From address
 */

import nodemailer, { type Transporter } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import addressparser from 'nodemailer/lib/addressparser'
import { isSingleEmailAddress } from '@/lib/messaging/address'
import type SESTransport from 'nodemailer/lib/ses-transport'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import {
  getSesConfigurationSet,
  getSesRegion,
  getTransportForStream,
  type EmailStream,
  type EmailTransportName,
} from '@/lib/email/config'

// ---------------------------------------------------------------------------
// Transporter singletons
// ---------------------------------------------------------------------------

let smtpTransporter: Transporter | null = null
let sesTransporter: Transporter<SESTransport.SentMessageInfo, SESTransport.Options> | null = null

function getSmtpTransporter(): Transporter {
  if (!smtpTransporter) {
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
    smtpTransporter = nodemailer.createTransport(options)
  }
  return smtpTransporter
}

function getSesTransporter(): Transporter<SESTransport.SentMessageInfo, SESTransport.Options> {
  if (!sesTransporter) {
    const accessKeyId = process.env.SES_ACCESS_KEY_ID
    const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY
    // Without dedicated SES keys the SDK's default chain picks up AWS_* keys.
    const sesClient = new SESv2Client({
      region: getSesRegion(),
      maxAttempts: 4,
      ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    })
    sesTransporter = nodemailer.createTransport({ SES: { sesClient, SendEmailCommand } })
  }
  return sesTransporter
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
// Retry logic for transient SMTP errors (the SES client retries on its own)
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
  /** Defaults to 'transactional'. Decides transport and SES configuration set. */
  stream?: EmailStream
  /** SES message tags (letters, digits, `_` and `-` only), e.g. { campaign: id }. */
  tags?: Record<string, string>
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

export interface SendResult {
  /** SMTP Message-ID, or the SES MessageId that SES events refer to. */
  messageId: string
  transport: EmailTransportName
}

interface NodemailerAttachment {
  filename: string
  content: Buffer
  contentType: string
}

function sesTags(stream: EmailStream, tags: Record<string, string> = {}) {
  return Object.entries({ stream, ...tags })
    .map(([Name, Value]) => ({ Name, Value: String(Value).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256) }))
    .filter((t) => /^[A-Za-z0-9_-]{1,256}$/.test(t.Name) && t.Value)
}

async function send(
  params: SendEmailParams,
  attachments: NodemailerAttachment[] = []
): Promise<SendResult> {
  const { to, subject, html, text, from, replyTo, cc, headers, tags } = params
  const stream = params.stream || 'transactional'
  const transport = getTransportForStream(stream)
  const toAddresses = (Array.isArray(to) ? to : [to]).map((a) => a.trim())
  const ccAddresses = cc ? (Array.isArray(cc) ? cc : [cc]).filter(Boolean).map((a) => a.trim()) : []
  // nodemailer parses a recipient string as an address list, so a value like
  // "a@x, b@y" or "Pal <b@y>" would reach mailboxes that no caller checked
  // against suppressions or limits. Every caller passes plain addresses.
  // The value checked must be exactly what nodemailer delivers to, so also
  // require its own parser to read it back unchanged as one address.
  for (const address of [...toAddresses, ...ccAddresses]) {
    const parsed = addressparser(address) as Array<{ address?: string }>
    if (!isSingleEmailAddress(address) || parsed.length !== 1 || parsed[0].address !== address) {
      throw new Error('Refusing to send: recipient is not a single email address')
    }
  }
  const fromAddress = from || DEFAULT_FROM()

  const mail = {
    from: formatFromAddress(fromAddress),
    to: toAddresses.join(', '),
    ...(ccAddresses.length > 0 ? { cc: ccAddresses.join(', ') } : {}),
    replyTo: replyTo || fromAddress,
    subject,
    html,
    ...(text ? { text } : {}),
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(headers && Object.keys(headers).length > 0 ? { headers } : {}),
  }

  if (transport === 'ses') {
    const configurationSet = getSesConfigurationSet(stream)
    const info = await getSesTransporter().sendMail({
      ...mail,
      ses: {
        ...(configurationSet ? { ConfigurationSetName: configurationSet } : {}),
        EmailTags: sesTags(stream, tags),
      },
    })
    // nodemailer's SES transport reports the raw SES MessageId as `response`.
    return { messageId: info.response || info.messageId || 'unknown', transport }
  }

  const info = await withRetry(() => getSmtpTransporter().sendMail(mail))
  // nodemailer returns "<id@domain>"; strip the angle brackets for storage
  return { messageId: (info.messageId || 'unknown').replace(/^<|>$/g, ''), transport }
}

/**
 * Send an email through the transport for its stream (transactional unless
 * `stream` says otherwise). Returns the message id and transport used.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  return send(params)
}

/**
 * Send an email with attachments. Attachment content is fetched from the
 * provided public URLs (S3/CDN) before sending.
 */
export async function sendRawEmail(params: SendRawEmailParams): Promise<SendResult> {
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
