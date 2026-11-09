/**
 * Branded email layout with the footer every marketing message must carry
 * (CAN-SPAM + alcohol-marketing basics):
 *   - why the person is receiving it (the list they subscribed to)
 *   - a working unsubscribe link, plus "manage preferences"
 *   - the sender's valid postal address
 *   - a 21+ / responsible-drinking line
 *
 * Transactional notices (credit earned, redemption status) use the same
 * layout; their footer still links to unsubscribe/preferences, and the postal
 * address is included when configured.
 *
 * Unsubscribe, preference, and confirm links carry `ses:no-track` so SES click
 * tracking doesn't rewrite them (and so they never count as engagement).
 */

import {
  COMPANY_LEGAL_NAME,
  RESPONSIBLE_DRINKING_LINE,
  getPostalAddress,
  getSiteOrigin,
} from '@/lib/email/config'
import { escapeHtml, renderBlocks, textToBlocks, type EmailBlock, type MergeVars } from '@/lib/email/blocks'

export { escapeHtml }

export class MissingPostalAddressError extends Error {
  constructor() {
    super('EMAIL_POSTAL_ADDRESS is not set; marketing email cannot be sent without a postal address.')
  }
}

export function reasonForList(listName: string): string {
  return `You're receiving this because you subscribed to ${listName} emails from Untamed Beverages.`
}

export interface LayoutParams {
  contentHtml: string
  contentText: string
  recipientEmail: string
  unsubscribeUrl: string
  preferencesUrl?: string | null
  /** One sentence: why this person is getting this email. */
  reason: string
  preheader?: string | null
  /** Optional primary button (e.g. the permission-request confirm link). */
  cta?: { label: string; url: string; noTrack?: boolean }
  /** Marketing requires the postal address; transactional includes it if set. */
  kind?: 'marketing' | 'transactional'
}

export function renderEmailLayout(params: LayoutParams): { html: string; text: string } {
  const kind = params.kind || 'marketing'
  const postalAddress = getPostalAddress()
  if (kind === 'marketing' && !postalAddress) throw new MissingPostalAddressError()

  const { contentHtml, contentText, recipientEmail, unsubscribeUrl, preferencesUrl, reason, preheader, cta } = params

  const ctaHtml = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;">
                <tr>
                  <td style="border-radius:999px;background:#9B30FF;">
                    <a ${cta.noTrack ? 'ses:no-track ' : ''}href="${escapeHtml(cta.url)}" style="display:inline-block;padding:13px 28px;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;border-radius:999px;">${escapeHtml(cta.label)}</a>
                  </td>
                </tr>
              </table>`
    : ''

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(preheader)}${'&#8204;&nbsp;'.repeat(40)}</div>`
    : ''

  const companyLine = postalAddress
    ? `${escapeHtml(COMPANY_LEGAL_NAME)} &middot; ${escapeHtml(postalAddress)}`
    : escapeHtml(COMPANY_LEGAL_NAME)

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#FFFFFF;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111;border:1px solid #2A2A2A;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px;">
              <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9B30FF;font-weight:700;margin-bottom:24px;">Untamed Beverages</div>
              ${contentHtml}
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #2A2A2A;color:#666;font-size:11px;line-height:1.6;text-align:center;">
              ${escapeHtml(reason)}<br>
              Sent to <span style="color:#888;">${escapeHtml(recipientEmail)}</span> &middot;
              ${preferencesUrl ? `<a ses:no-track href="${escapeHtml(preferencesUrl)}" style="color:#9B30FF;text-decoration:underline;">Manage preferences</a> &middot;` : ''}
              <a ses:no-track href="${escapeHtml(unsubscribeUrl)}" style="color:#9B30FF;text-decoration:underline;">Unsubscribe</a><br>
              ${companyLine}<br>
              ${escapeHtml(RESPONSIBLE_DRINKING_LINE)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    contentText.trim(),
    ...(cta ? ['', `${cta.label}: ${cta.url}`] : []),
    '',
    '---',
    reason,
    ...(preferencesUrl ? [`Manage preferences: ${preferencesUrl}`] : []),
    `Unsubscribe: ${unsubscribeUrl}`,
    postalAddress ? `${COMPANY_LEGAL_NAME}, ${postalAddress}` : COMPANY_LEGAL_NAME,
    RESPONSIBLE_DRINKING_LINE,
  ].join('\n')

  return { html, text }
}

export interface MarketingEmailParams {
  /** Plain-text body; blank lines become paragraphs. */
  textBody: string
  recipientEmail: string
  unsubscribeUrl: string
  preferencesUrl?: string | null
  reason: string
  preheader?: string | null
  cta?: { label: string; url: string; noTrack?: boolean }
}

/** Plain-text marketing email (permission request, legacy blasts). */
export function renderMarketingEmail(params: MarketingEmailParams): { html: string; text: string } {
  const content = renderBlocks(textToBlocks(params.textBody), {})
  return renderEmailLayout({
    ...params,
    contentHtml: content.html,
    contentText: content.text,
    kind: 'marketing',
  })
}

export interface BlocksEmailParams {
  blocks: EmailBlock[]
  vars: MergeVars
  recipientEmail: string
  unsubscribeUrl: string
  preferencesUrl?: string | null
  reason: string
  preheader?: string | null
  utmCampaign?: string | null
  kind?: 'marketing' | 'transactional'
}

/** Block-based email (campaigns, flows, templates). */
export function renderBlocksEmail(params: BlocksEmailParams): { html: string; text: string } {
  let siteHost: string | undefined
  try {
    siteHost = new URL(getSiteOrigin()).hostname
  } catch {
    siteHost = undefined
  }
  const content = renderBlocks(params.blocks, params.vars, { utmCampaign: params.utmCampaign, siteHost })
  return renderEmailLayout({
    contentHtml: content.html,
    contentText: content.text,
    recipientEmail: params.recipientEmail,
    unsubscribeUrl: params.unsubscribeUrl,
    preferencesUrl: params.preferencesUrl,
    reason: params.reason,
    preheader: params.preheader,
    kind: params.kind,
  })
}

/** Footer lines for other promotional templates (e.g. referral warm intros). */
export function complianceFooterLines(): { postalLine: string; responsibleLine: string } {
  const postalAddress = getPostalAddress()
  return {
    postalLine: postalAddress ? `${COMPANY_LEGAL_NAME} · ${postalAddress}` : COMPANY_LEGAL_NAME,
    responsibleLine: RESPONSIBLE_DRINKING_LINE,
  }
}
