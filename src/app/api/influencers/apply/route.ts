import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAndLogEmail } from '@/lib/messaging/email-log'
import { resolveLeadAttribution } from '@/lib/tracking/lead-attribution'
import { fbcFromFbclid, sendMetaCapiEvent } from '@/lib/tracking/meta-capi'
import {
  COMPENSATION_LABELS,
  COMPENSATION_PREFS,
  CONTENT_FOCUS_LABELS,
  CONTENT_FOCUSES,
  FOLLOWER_TIER_LABELS,
  FOLLOWER_TIERS,
  INFLUENCER_PLATFORMS,
  PLATFORM_LABELS,
  cleanHandle,
  withHttps,
} from '@/lib/influencers/constants'

const LEAD_NOTIFY_EMAIL = 'joe.colella@untamedbeverages.com'
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://untamedbevs.com'

const applySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Valid email is required'),
  phone: z.string().max(40).optional(),
  location: z.string().min(1, 'City is required').max(200),
  primaryPlatform: z.enum(INFLUENCER_PLATFORMS),
  handle: z.string().min(1, 'Handle is required').max(120),
  profileUrl: z.string().min(1, 'Profile URL is required').max(500),
  otherHandles: z.string().max(400).optional(),
  followerTier: z.enum(FOLLOWER_TIERS),
  contentFocus: z.enum(CONTENT_FOCUSES),
  compensation: z.enum(COMPENSATION_PREFS).optional(),
  contentLink: z.string().max(500).optional(),
  message: z.string().max(2000).optional(),
  is21: z.literal(true, { error: 'You must be 21 or older' }),
  audienceIs21: z.literal(true, { error: 'Audience must be 21+' }),
  website: z.string().max(200).optional(),
  visitor_id: z.string().max(80).optional(),
  session_id: z.string().max(80).optional(),
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  utm_term: z.string().max(200).optional(),
  gclid: z.string().max(200).optional(),
  fbclid: z.string().max(200).optional(),
  referrer: z.string().max(2000).optional(),
  landing_page: z.string().max(500).optional(),
  event_id: z.string().max(80).optional(),
  fbp: z.string().max(200).optional(),
  fbc: z.string().max(500).optional(),
})

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 3

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_LIMIT_MAX) return true
  entry.count++
  return false
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = applySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid data' },
        { status: 400 }
      )
    }

    if (parsed.data.website) {
      return NextResponse.json({ success: true })
    }

    const data = parsed.data
    const profileUrl = withHttps(data.profileUrl)
    if (!isHttpUrl(profileUrl)) {
      return NextResponse.json({ error: 'Profile URL must be a valid link' }, { status: 400 })
    }

    const contentLink = data.contentLink ? withHttps(data.contentLink) : null
    if (contentLink && !isHttpUrl(contentLink)) {
      return NextResponse.json({ error: 'Content link must be a valid URL' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const eventId = data.event_id || randomUUID()
    const attribution = await resolveLeadAttribution(supabase, {
      visitor_id: data.visitor_id,
      session_id: data.session_id,
      utm_source: data.utm_source,
      utm_medium: data.utm_medium,
      utm_campaign: data.utm_campaign,
      utm_content: data.utm_content,
      utm_term: data.utm_term,
      gclid: data.gclid,
      fbclid: data.fbclid,
      referrer: data.referrer,
      landing_page: data.landing_page || '/influencers',
    })

    const { data: lead, error: leadError } = await supabase
      .from('influencer_leads')
      .insert({
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        phone: data.phone?.trim() || null,
        location: data.location.trim(),
        primary_platform: data.primaryPlatform,
        handle: cleanHandle(data.handle),
        profile_url: profileUrl,
        other_handles: data.otherHandles?.trim() || null,
        follower_tier: data.followerTier,
        content_focus: data.contentFocus,
        compensation: data.compensation || 'open',
        content_link: contentLink,
        message: data.message?.trim() || null,
        is_21: true,
        audience_is_21: true,
        event_id: eventId,
        ...attribution,
      })
      .select('id')
      .single()

    if (leadError) throw leadError

    try {
      const [firstName, ...rest] = data.name.trim().split(/\s+/)
      await sendMetaCapiEvent({
        eventName: 'Lead',
        eventId,
        eventSourceUrl: `${SITE}/influencers`,
        userData: {
          email: data.email,
          phone: data.phone,
          firstName,
          lastName: rest.join(' ') || null,
          fbc: data.fbc || fbcFromFbclid(attribution.converting_fbclid || attribution.first_fbclid),
          fbp: data.fbp,
          clientIpAddress: ip !== 'unknown' ? ip : null,
          clientUserAgent: request.headers.get('user-agent'),
        },
        customData: {
          content_name: cleanHandle(data.handle),
          content_category: `influencer_${data.primaryPlatform}`,
          status: 'new',
        },
      })
    } catch (capiErr) {
      console.error('[influencers/apply] Meta CAPI failed:', capiErr)
    }

    try {
      await sendAndLogEmail({
        to: LEAD_NOTIFY_EMAIL,
        replyTo: data.email,
        subject: `New Creator Application: ${data.name} (@${cleanHandle(data.handle)})`,
        html: renderNotificationHtml(data, profileUrl),
        text: renderNotificationText(data, profileUrl),
        templateSlug: 'influencer-lead-notification',
      })
    } catch (emailErr) {
      console.error('[influencers/apply] Notification email failed:', emailErr)
    }

    return NextResponse.json({ success: true, leadId: lead.id, eventId })
  } catch (err) {
    console.error('[influencers/apply] Failed:', err)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }
}

type ApplyData = z.infer<typeof applySchema>

function leadFields(data: ApplyData, profileUrl: string): Array<[string, string]> {
  const fields: Array<[string, string]> = [
    ['Name', data.name],
    ['Email', data.email],
  ]
  if (data.phone) fields.push(['Phone', data.phone])
  fields.push(['Location', data.location])
  fields.push(['Platform', PLATFORM_LABELS[data.primaryPlatform]])
  fields.push(['Handle', `@${cleanHandle(data.handle)}`])
  fields.push(['Profile', profileUrl])
  if (data.otherHandles) fields.push(['Other handles', data.otherHandles])
  fields.push(['Followers', FOLLOWER_TIER_LABELS[data.followerTier]])
  fields.push(['Focus', CONTENT_FOCUS_LABELS[data.contentFocus]])
  fields.push(['Compensation', COMPENSATION_LABELS[data.compensation || 'open']])
  if (data.contentLink) fields.push(['Sample post', withHttps(data.contentLink)])
  if (data.message) fields.push(['Message', data.message])
  return fields
}

function renderNotificationText(data: ApplyData, profileUrl: string): string {
  return [
    'New creator application from untamedbeverages.com/influencers:',
    '',
    ...leadFields(data, profileUrl).map(([label, value]) => `${label}: ${value}`),
  ].join('\n')
}

function renderNotificationHtml(data: ApplyData, profileUrl: string): string {
  const rows = leadFields(data, profileUrl)
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;color:#888;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:8px 12px;color:#EDEDED;font-size:14px;">${escapeHtml(value).replace(/\n/g, '<br>')}</td>
        </tr>`
    )
    .join('')

  return `
    <div style="background:#0A0A0A;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#141414;border:1px solid #2A2A2A;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #2A2A2A;">
            <span style="color:#9B30FF;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Untamed Beverages</span>
            <h1 style="margin:8px 0 0;color:#FFFFFF;font-size:20px;">New Creator Application</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #2A2A2A;color:#666;font-size:12px;">
            Reply to this email to respond directly, or view it in the
            <a href="https://untamedbeverages.com/admin/influencers" style="color:#9B30FF;">creator workbench</a>.
          </td>
        </tr>
      </table>
    </div>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
