/**
 * Stored email templates (`email_templates` table).
 *
 * Transactional use from server code, e.g. an order note from orders@:
 *
 *   await sendTemplateEmail('order-update', {
 *     to: 'customer@example.com',
 *     vars: { first_name: 'Sam', order_number: 'UB-1042', message: 'Your order shipped!' },
 *   })
 *
 * The template's sender_id ('orders', 'support', 'loyalty') picks the From
 * address unless `fromAlias` is passed. Throws if the template is missing,
 * archived, or a merge tag in it has no value.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendAndLogEmail, type LoggedEmailParams } from '@/lib/messaging/email-log'
import { applyVariables, missingVariables, renderEmailHtml, renderEmailText, type EmailLayout } from '@/lib/email/render'
import { getSenderById } from '@/lib/crm/senders'

export interface EmailTemplate {
  id: string
  slug: string
  name: string
  kind: 'campaign' | 'transactional'
  subject: string
  body: string
  preheader: string | null
  layout: EmailLayout
  sender_id: string | null
  default_audience: 'loyalty' | 'referrers' | 'distributors' | 'all' | 'staff' | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export async function getTemplateBySlug(slug: string): Promise<EmailTemplate | null> {
  const { data } = await createAdminClient()
    .from('email_templates')
    .select('*')
    .eq('slug', slug)
    .eq('is_archived', false)
    .maybeSingle()
  return (data as EmailTemplate | null) ?? null
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export function renderTemplate(
  template: Pick<EmailTemplate, 'subject' | 'body' | 'preheader'> & { layout?: EmailLayout | null },
  vars: Record<string, string>,
  opts: { unsubscribeUrl?: string; recipientEmail?: string } = {}
): RenderedEmail {
  const body = applyVariables(template.body, vars)
  return {
    subject: applyVariables(template.subject, vars),
    html: renderEmailHtml({
      body,
      preheader: template.preheader ? applyVariables(template.preheader, vars) : undefined,
      unsubscribeUrl: opts.unsubscribeUrl,
      recipientEmail: opts.recipientEmail,
      layout: template.layout ?? 'branded',
    }),
    text: renderEmailText(body, opts.unsubscribeUrl),
  }
}

export interface SendTemplateParams
  extends Omit<LoggedEmailParams, 'subject' | 'html' | 'text' | 'templateSlug'> {
  vars?: Record<string, string>
}

/** Render a stored template and send it immediately (logged to email_messages). */
export async function sendTemplateEmail(slug: string, params: SendTemplateParams): Promise<string> {
  const template = await getTemplateBySlug(slug)
  if (!template) throw new Error(`Email template "${slug}" not found or archived`)

  const { vars = {}, ...rest } = params
  const missing = missingVariables(`${template.subject}\n${template.body}\n${template.preheader ?? ''}`, vars)
  if (missing.length > 0) {
    throw new Error(`Email template "${slug}" is missing values for: ${missing.join(', ')}`)
  }

  const rendered = renderTemplate(template, vars)
  const fromAlias =
    rest.fromAlias ?? (template.sender_id ? getSenderById(template.sender_id).email : undefined)

  return sendAndLogEmail({
    ...rest,
    fromAlias,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    templateSlug: template.slug,
  })
}
