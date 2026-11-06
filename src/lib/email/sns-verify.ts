/**
 * Amazon SNS message verification.
 *
 * SNS signs every message with a certificate hosted on an
 * `sns.<region>.amazonaws.com` HTTPS URL. We rebuild the canonical string
 * (https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html),
 * check it against that certificate, and only then trust the payload or
 * fetch its SubscribeURL.
 */

import { createVerify } from 'crypto'

export interface SnsEnvelope {
  Type: string
  MessageId: string
  TopicArn: string
  Timestamp: string
  SignatureVersion: string
  Signature: string
  SigningCertURL: string
  Message?: string
  Subject?: string
  Token?: string
  SubscribeURL?: string
  UnsubscribeURL?: string
}

const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/

/** True for an HTTPS URL on an Amazon SNS endpoint. */
export function isSnsUrl(value: string | undefined, pathSuffix?: string): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !SNS_HOST.test(url.hostname)) return false
    if (pathSuffix && !url.pathname.endsWith(pathSuffix)) return false
    return true
  } catch {
    return false
  }
}

const NOTIFICATION_KEYS = ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'] as const
const SUBSCRIPTION_KEYS = ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'] as const

export function buildStringToSign(envelope: SnsEnvelope): string | null {
  const keys =
    envelope.Type === 'Notification'
      ? NOTIFICATION_KEYS
      : envelope.Type === 'SubscriptionConfirmation' || envelope.Type === 'UnsubscribeConfirmation'
        ? SUBSCRIPTION_KEYS
        : null
  if (!keys) return null

  let out = ''
  for (const key of keys) {
    const value = envelope[key]
    if (value === undefined || value === null) {
      if (key === 'Subject') continue // optional on notifications
      return null
    }
    out += `${key}\n${value}\n`
  }
  return out
}

const certCache = new Map<string, string>()

async function getCertificate(url: string): Promise<string> {
  const cached = certCache.get(url)
  if (cached) return cached
  const res = await fetch(url, { redirect: 'error' })
  if (!res.ok) throw new Error(`SNS certificate fetch failed (${res.status})`)
  const pem = await res.text()
  if (!pem.includes('BEGIN CERTIFICATE')) throw new Error('SNS certificate is not PEM')
  certCache.set(url, pem)
  return pem
}

export function isSnsEnvelope(value: unknown): value is SnsEnvelope {
  const v = value as Record<string, unknown> | null
  return Boolean(
    v &&
      typeof v.Type === 'string' &&
      typeof v.MessageId === 'string' &&
      typeof v.TopicArn === 'string' &&
      typeof v.Timestamp === 'string' &&
      typeof v.Signature === 'string' &&
      typeof v.SigningCertURL === 'string' &&
      (v.SignatureVersion === '1' || v.SignatureVersion === '2')
  )
}

/**
 * Verify an SNS message signature. Returns false for anything that doesn't
 * check out, including certificates hosted outside SNS.
 */
export async function verifySnsSignature(
  envelope: SnsEnvelope,
  fetchCertificate: (url: string) => Promise<string> = getCertificate
): Promise<boolean> {
  if (!isSnsUrl(envelope.SigningCertURL, '.pem')) return false
  const stringToSign = buildStringToSign(envelope)
  if (!stringToSign) return false

  try {
    const pem = await fetchCertificate(envelope.SigningCertURL)
    const verifier = createVerify(envelope.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1')
    verifier.update(stringToSign, 'utf8')
    return verifier.verify(pem, envelope.Signature, 'base64')
  } catch (err) {
    console.error('[SNS] Signature verification error:', err instanceof Error ? err.message : err)
    return false
  }
}
