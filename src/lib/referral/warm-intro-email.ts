/**
 * Warm intro email template (shared by /api/referral/send and
 * /api/portal/referrals/send).
 */

export function buildWarmIntroEmail(params: {
  referredFirstName: string | null
  referrerName: string
  inviteType: 'consumer' | 'distributor'
  referralUrl: string
  customMessage: string
}): { subject: string; html: string; text: string } {
  const { referredFirstName, referrerName, inviteType, referralUrl, customMessage } =
    params
  const greeting = referredFirstName ? `Hey ${referredFirstName},` : 'Hey,'

  const intro =
    inviteType === 'distributor'
      ? `${referrerName} thinks Untamed Beverages would be a great fit for your business.`
      : `${referrerName} wanted you to try Untamed Beverages.`

  const cta = inviteType === 'distributor' ? 'See the retail program' : 'Try Untamed'

  const text = [
    greeting,
    '',
    intro,
    '',
    customMessage ? `"${customMessage}"\n` : '',
    `${cta}: ${referralUrl}`,
    '',
    '— The Untamed Pack',
  ]
    .filter((l) => l !== null && l !== undefined)
    .join('\n')

  const safeMessage = escapeHtml(customMessage)
  const safeReferrer = escapeHtml(referrerName)
  const safeIntro = escapeHtml(intro)
  const safeCta = escapeHtml(cta)

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#FFFFFF;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111;border:1px solid #2A2A2A;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px;">
              <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9B30FF;font-weight:700;margin-bottom:24px;">
                Untamed Beverages
              </div>
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#FFFFFF;">
                ${escapeHtml(greeting)}
              </h1>
              <p style="margin:0 0 16px;color:#D0D0D0;font-size:15px;line-height:1.6;">
                ${safeIntro}
              </p>
              ${
                safeMessage
                  ? `<blockquote style="margin:16px 0;padding:14px 18px;border-left:3px solid #9B30FF;background:#1A1A1A;color:#D0D0D0;font-size:15px;line-height:1.5;border-radius:0 8px 8px 0;">${safeMessage}</blockquote>`
                  : ''
              }
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
                <tr>
                  <td style="border-radius:999px;background:#9B30FF;">
                    <a href="${referralUrl}" style="display:inline-block;padding:13px 28px;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;border-radius:999px;">
                      ${safeCta}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#666;font-size:12px;line-height:1.5;">
                Sent by ${safeReferrer} via the Untamed referral program.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const subject =
    inviteType === 'distributor'
      ? `${referrerName} thinks Untamed is right for your business`
      : `${referrerName} sent you something untamed`

  return { subject, html, text }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
