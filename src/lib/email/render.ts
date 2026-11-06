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
  { tag: '{{first_name}}', label: 'First Name' },
  { tag: '{{name}}', label: 'Name' },
  { tag: '{{email}}', label: 'Email' },
  { tag: '{{portal_login_url}}', label: 'Portal Login URL' },
  { tag: '{{community_url}}', label: 'Community URL' },
  { tag: '{{hunts_url}}', label: 'Hunts URL' },
  { tag: '{{rewards_url}}', label: 'Rewards URL' },
] as const

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

const LINK_STYLE = 'color:#B560FF;text-decoration:underline;'

function formatInline(escaped: string): string {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#FFFFFF;">$1</strong>')
    .replace(
      /(https?:\/\/[^\s<]+[^\s<.,;:!?)'"&])/g,
      (url) => `<a href="${url}" style="${LINK_STYLE}">${url}</a>`
    )
}

/** Convert a plain-text body into paragraph HTML (no outer layout). */
export function bodyToHtml(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 16px 0;">${formatInline(escapeHtml(para)).replace(/\n/g, '<br>')}</p>`
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
}

/** Wrap a body in the branded Untamed email layout. */
export function renderEmailHtml({
  body,
  preheader,
  unsubscribeUrl,
  recipientEmail,
}: LayoutOptions): string {
  const footer = unsubscribeUrl
    ? `You're receiving this because you signed up for Untamed updates${
        recipientEmail ? ` as <span style="color:#888;">${escapeHtml(recipientEmail)}</span>` : ''
      }.<br>
              <a href="${unsubscribeUrl}" style="color:#9B30FF;text-decoration:underline;">Unsubscribe</a>
              &nbsp;&middot;&nbsp;
              Untamed Beverages, LLC`
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

/** Plain-text alternative: strip **bold** markers, append unsubscribe link. */
export function renderEmailText(body: string, unsubscribeUrl?: string): string {
  const text = body.replace(/\*\*(.+?)\*\*/g, '$1').trim()
  return unsubscribeUrl ? `${text}\n\n---\nUnsubscribe: ${unsubscribeUrl}` : text
}
