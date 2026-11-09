/**
 * Email rendering shared by the blast composer (live preview), the queue
 * worker, test sends and transactional templates.
 *
 * Pure string functions with no server imports, so it is safe in client code.
 *
 * Body format is plain text with a few conveniences:
 *   - {{merge_tags}} are replaced from the vars map
 *   - blank line = new paragraph, single newline = line break
 *   - **bold** text
 *   - bare https:// URLs become links
 */

export const MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'First name', group: 'Person' },
  { tag: '{{name}}', label: 'Full name', group: 'Person' },
  { tag: '{{email}}', label: 'Email', group: 'Person' },
  { tag: '{{portal_url}}', label: 'Portal', group: 'Portal' },
  { tag: '{{portal_login_url}}', label: 'Portal login', group: 'Portal' },
  { tag: '{{portal_referrals_url}}', label: 'Portal referrals page', group: 'Portal' },
  { tag: '{{community_url}}', label: 'Community', group: 'Portal' },
  { tag: '{{hunts_url}}', label: 'Hunts', group: 'Portal' },
  { tag: '{{rewards_url}}', label: 'Rewards', group: 'Portal' },
  { tag: '{{referral_link}}', label: 'Referral link', group: 'Referral' },
  { tag: '{{shop_referral_link}}', label: 'Shop referral link', group: 'Referral' },
  { tag: '{{retail_referral_link}}', label: 'Retail referral link', group: 'Referral' },
  { tag: '{{referral_code}}', label: 'Referral code', group: 'Referral' },
] as const

/** Example link values for previews in the composer and template editor. */
export const SAMPLE_LINK_VARS: Record<string, string> = {
  portal_url: 'https://untamedbeverages.com/portal',
  portal_login_url: 'https://untamedbeverages.com/portal/login',
  portal_referrals_url: 'https://untamedbeverages.com/portal/login?returnTo=%2Fportal%2Freferrals',
  referral_link: 'https://untamedbeverages.com/?ref=ALEX42',
  shop_referral_link: 'https://untamedbeverages.com/shop?ref=ALEX42',
  retail_referral_link: 'https://untamedbeverages.com/retail?ref=ALEX42',
  referral_code: 'ALEX42',
  community_url: 'https://untamedbeverages.com/community',
  hunts_url: 'https://untamedbeverages.com/portal/hunts',
  rewards_url: 'https://untamedbeverages.com/portal/rewards',
}

export function applyVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match
  )
}

/** Merge tags present in the text that the vars map can't fill. */
export function missingVariables(text: string, vars: Record<string, string>): string[] {
  const missing = new Set<string>()
  for (const m of text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) {
    if (!Object.prototype.hasOwnProperty.call(vars, m[1])) missing.add(m[1])
  }
  return [...missing]
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export type EmailLayout = 'branded' | 'plain'

const LINK_STYLE = 'color:#B560FF;text-decoration:underline;'

function formatInline(escaped: string, layout: EmailLayout = 'branded'): string {
  // Plain emails keep the reader's own text and link colors, like a personal email.
  const strong = layout === 'plain' ? '<strong>$1</strong>' : '<strong style="color:#FFFFFF;">$1</strong>'
  const linkStyle = layout === 'plain' ? '' : ` style="${LINK_STYLE}"`
  return escaped
    .replace(/\*\*(.+?)\*\*/g, strong)
    .replace(
      /(https?:\/\/[^\s<]+[^\s<.,;:!?)'"&])/g,
      (url) => `<a href="${url}"${linkStyle}>${url}</a>`
    )
}

/** Convert a plain-text body into paragraph HTML (no outer layout). */
export function bodyToHtml(text: string, layout: EmailLayout = 'branded'): string {
  return text
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 16px 0;">${formatInline(escapeHtml(para), layout).replace(/\n/g, '<br>')}</p>`
    )
    .join('\n')
}

export interface LayoutOptions {
  /** Plain-text body (already merged) */
  body: string
  /** Hidden inbox preview line */
  preheader?: string
  /** Bulk mail: include the unsubscribe footer */
  unsubscribeUrl?: string
  recipientEmail?: string
  /** Bulk mail: sender's postal address (CAN-SPAM) */
  postalAddress?: string
  /** Bulk mail: privacy policy link */
  privacyUrl?: string
  /** 'branded' = dark card layout; 'plain' = reads like a personal email */
  layout?: EmailLayout
}

/** Wrap a body in the branded Untamed email layout. */
export function renderEmailHtml({
  body,
  preheader,
  unsubscribeUrl,
  recipientEmail,
  postalAddress,
  privacyUrl,
  layout = 'branded',
}: LayoutOptions): string {
  if (layout === 'plain') {
    return renderPlainEmailHtml({ body, preheader, unsubscribeUrl, recipientEmail, postalAddress, privacyUrl })
  }
  const linkStyle = 'color:#9B30FF;text-decoration:underline;'
  const footer = unsubscribeUrl
    ? `You're receiving this because you signed up for Untamed updates${
        recipientEmail ? ` as <span style="color:#888;">${escapeHtml(recipientEmail)}</span>` : ''
      }.<br>
              <a href="${escapeHtml(unsubscribeUrl)}" style="${linkStyle}">Unsubscribe</a>${
                privacyUrl
                  ? `
              &nbsp;&middot;&nbsp;
              <a href="${escapeHtml(privacyUrl)}" style="${linkStyle}">Privacy Policy</a>`
                  : ''
              }<br>
              Untamed Beverages, LLC${postalAddress ? ` &middot; ${escapeHtml(postalAddress)}` : ''}<br>
              For adults 21 and over. Please enjoy responsibly.`
    : 'Untamed Beverages, LLC'

  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`
    : ''

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#FFFFFF;">
  ${pre}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111;border:1px solid #2A2A2A;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px;">
              <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9B30FF;font-weight:700;margin-bottom:24px;">Untamed Beverages</div>
              <div style="color:#D0D0D0;font-size:15px;line-height:1.6;">${bodyToHtml(body)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #2A2A2A;color:#666;font-size:11px;line-height:1.5;text-align:center;">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * A personal-looking email: no background, card or brand bar, the reader's
 * own font colors (so it suits light and dark mail apps), and a small grey
 * footer that keeps the unsubscribe link bulk mail needs.
 */
function renderPlainEmailHtml({
  body,
  preheader,
  unsubscribeUrl,
  recipientEmail,
  postalAddress,
  privacyUrl,
}: LayoutOptions): string {
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`
    : ''
  const footer = unsubscribeUrl
    ? `You're getting this because you signed up for Untamed updates${
        recipientEmail ? ` as ${escapeHtml(recipientEmail)}` : ''
      }. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#888;">Unsubscribe</a>${
        privacyUrl ? ` &middot; <a href="${escapeHtml(privacyUrl)}" style="color:#888;">Privacy Policy</a>` : ''
      }<br>Untamed Beverages, LLC${postalAddress ? ` &middot; ${escapeHtml(postalAddress)}` : ''}<br>For adults 21 and over. Please enjoy responsibly.`
    : 'Untamed Beverages, LLC'

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;">
  ${pre}
  <div style="max-width:600px;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;">
    ${bodyToHtml(body, 'plain')}
    <p style="margin:32px 0 0 0;font-size:12px;line-height:1.5;color:#888;">${footer}</p>
  </div>
</body>
</html>`
}

/** Plain-text alternative: strip **bold** markers, append the bulk-mail footer. */
export function renderEmailText(
  body: string,
  unsubscribeUrl?: string,
  footer: { postalAddress?: string; privacyUrl?: string } = {}
): string {
  const text = body.replace(/\*\*(.+?)\*\*/g, '$1').trim()
  if (!unsubscribeUrl) return text
  const lines = [
    `Unsubscribe: ${unsubscribeUrl}`,
    footer.privacyUrl ? `Privacy Policy: ${footer.privacyUrl}` : null,
    `Untamed Beverages, LLC${footer.postalAddress ? `, ${footer.postalAddress}` : ''}`,
    'For adults 21 and over. Please enjoy responsibly.',
  ].filter(Boolean)
  return `${text}\n\n---\n${lines.join('\n')}`
}
