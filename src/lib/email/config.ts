/**
 * Email system configuration and the "can we send marketing?" readiness check.
 *
 * Marketing email (blasts and the one-time permission request) only goes out
 * when every legal and deliverability prerequisite is configured. The blast
 * API refuses to queue and the queue worker leaves messages pending until
 * `getMarketingReadiness().ready` is true.
 *
 * Env (all optional unless noted for marketing):
 *   EMAIL_TRANSPORT                  'smtp' (default) | 'ses' -- transactional mail
 *   EMAIL_MARKETING_TRANSPORT        'ses' (default) | 'smtp'
 *   EMAIL_ALLOW_SMTP_MARKETING       'true' to permit marketing over Google Workspace (not recommended)
 *   SES_REGION                       defaults to AWS_REGION, then us-east-1
 *   SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY  dedicated SES keys; otherwise the AWS_* keys are used
 *   SES_CONFIGURATION_SET_MARKETING  required for marketing (bounce/complaint/engagement events)
 *   SES_CONFIGURATION_SET_TRANSACTIONAL
 *   SES_SNS_TOPIC_ARNS               required for marketing; comma-separated topics the webhook accepts
 *   EMAIL_POSTAL_ADDRESS             required for marketing (CAN-SPAM): full street or registered PO box address
 *   EMAIL_MARKETING_COUNTRIES        comma-separated ISO codes, default 'US'; '*' allows any
 *   EMAIL_MARKETING_DAILY_CAP        max marketing emails per UTC day (warm-up); unset = no cap
 *   EMAIL_SEND_RATE_PER_SECOND       default 10 (new SES production accounts allow 14/s)
 *   EMAIL_REPERMISSION_APPROVED_VERSION  copy version counsel approved; gates the permission request
 *   EMAIL_CHECKOUT_CONSENT_APPROVED_VERSION  approved AccelPay checkbox version; gates checkout opt-ins
 */

export type EmailStream = 'marketing' | 'transactional'
export type EmailTransportName = 'smtp' | 'ses'

export const COMPANY_LEGAL_NAME = 'Untamed Beverages, LLC'
export const BRAND_NAME = 'Untamed Beverages'
export const RESPONSIBLE_DRINKING_LINE =
  'Untamed is for adults 21 and over. Please enjoy responsibly.'
export const DEFAULT_SITE_ORIGIN = 'https://untamedbeverages.com'

function clean(v: string | undefined): string | undefined {
  return v && v.trim() ? v.trim() : undefined
}

export function getSiteOrigin(): string {
  return (clean(process.env.NEXT_PUBLIC_SITE_URL) || DEFAULT_SITE_ORIGIN).replace(/\/$/, '')
}

export function getTransportForStream(stream: EmailStream): EmailTransportName {
  if (stream === 'marketing') {
    return clean(process.env.EMAIL_MARKETING_TRANSPORT) === 'smtp' ? 'smtp' : 'ses'
  }
  return clean(process.env.EMAIL_TRANSPORT) === 'ses' ? 'ses' : 'smtp'
}

export function getSesRegion(): string {
  return clean(process.env.SES_REGION) || clean(process.env.AWS_REGION) || 'us-east-1'
}

export function hasSesCredentials(): boolean {
  return Boolean(
    (clean(process.env.SES_ACCESS_KEY_ID) && clean(process.env.SES_SECRET_ACCESS_KEY)) ||
      (clean(process.env.AWS_ACCESS_KEY_ID) && clean(process.env.AWS_SECRET_ACCESS_KEY))
  )
}

export function getSesConfigurationSet(stream: EmailStream): string | undefined {
  return stream === 'marketing'
    ? clean(process.env.SES_CONFIGURATION_SET_MARKETING)
    : clean(process.env.SES_CONFIGURATION_SET_TRANSACTIONAL)
}

export function getAllowedSnsTopicArns(): string[] {
  return (clean(process.env.SES_SNS_TOPIC_ARNS) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function getPostalAddress(): string | undefined {
  return clean(process.env.EMAIL_POSTAL_ADDRESS)
}

/** Allowed recipient countries for marketing; null means no restriction. */
export function getMarketingCountries(): string[] | null {
  const raw = clean(process.env.EMAIL_MARKETING_COUNTRIES) || 'US'
  if (raw === '*') return null
  const codes = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{2}$/.test(s))
  return codes.length > 0 ? codes : ['US']
}

export function getMarketingDailyCap(): number | null {
  const n = parseInt(clean(process.env.EMAIL_MARKETING_DAILY_CAP) || '', 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function getSendRatePerSecond(): number {
  const n = parseFloat(clean(process.env.EMAIL_SEND_RATE_PER_SECOND) || '')
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 10
}

export function getApprovedRepermissionVersion(): string | undefined {
  return clean(process.env.EMAIL_REPERMISSION_APPROVED_VERSION)
}

export function getApprovedCheckoutConsentVersion(): string | undefined {
  return clean(process.env.EMAIL_CHECKOUT_CONSENT_APPROVED_VERSION)
}

export interface MarketingReadiness {
  ready: boolean
  /** Blocking problems: marketing will not queue or send until fixed. */
  issues: string[]
  /** Non-blocking notes worth showing staff. */
  warnings: string[]
  transport: EmailTransportName
  dailyCap: number | null
  countries: string[] | null
}

export function getMarketingReadiness(): MarketingReadiness {
  const issues: string[] = []
  const warnings: string[] = []
  const transport = getTransportForStream('marketing')

  if (transport === 'smtp') {
    if (clean(process.env.EMAIL_ALLOW_SMTP_MARKETING) !== 'true') {
      issues.push(
        'Marketing email is set to go through Google Workspace. Switch EMAIL_MARKETING_TRANSPORT to ses.'
      )
    } else {
      warnings.push(
        'Marketing is going through Google Workspace: no bounce, complaint, or engagement tracking, and staff mail shares the reputation.'
      )
    }
  } else {
    if (!hasSesCredentials()) issues.push('Amazon SES credentials are not configured.')
    if (!getSesConfigurationSet('marketing')) {
      issues.push('SES_CONFIGURATION_SET_MARKETING is not set, so bounces and complaints would go untracked.')
    }
    if (getAllowedSnsTopicArns().length === 0) {
      issues.push('SES_SNS_TOPIC_ARNS is not set, so the bounce/complaint webhook rejects every notification.')
    }
  }

  if (!getPostalAddress()) {
    issues.push('EMAIL_POSTAL_ADDRESS is not set. CAN-SPAM requires a valid postal address in every marketing email.')
  }
  if (!clean(process.env.CRON_SECRET)) {
    issues.push('CRON_SECRET is not set, so unsubscribe links cannot be signed.')
  }
  if (!clean(process.env.NEXT_PUBLIC_SITE_URL)) {
    warnings.push(`NEXT_PUBLIC_SITE_URL is not set; links will use ${DEFAULT_SITE_ORIGIN}.`)
  } else if (/localhost|127\.0\.0\.1/.test(clean(process.env.NEXT_PUBLIC_SITE_URL)!)) {
    warnings.push('NEXT_PUBLIC_SITE_URL points at localhost, so unsubscribe links will not work for recipients.')
  }

  const dailyCap = getMarketingDailyCap()
  if (dailyCap === null && transport === 'ses') {
    warnings.push('No daily marketing cap is set. Keep a cap while the domain warms up.')
  }
  if (getTransportForStream('transactional') === 'smtp') {
    warnings.push('Transactional email still goes through Google Workspace (EMAIL_TRANSPORT=smtp).')
  }

  return {
    ready: issues.length === 0,
    issues,
    warnings,
    transport,
    dailyCap,
    countries: getMarketingCountries(),
  }
}
