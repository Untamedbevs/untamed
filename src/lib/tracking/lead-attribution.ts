import type { SupabaseClient } from '@supabase/supabase-js'

export interface LeadAttributionInput {
  visitor_id?: string | null
  session_id?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_content?: string | null
  utm_term?: string | null
  gclid?: string | null
  fbclid?: string | null
  referrer?: string | null
  landing_page?: string | null
}

export interface LeadAttributionRow {
  visitor_fingerprint: string | null
  session_id: string | null
  first_utm_source: string | null
  first_utm_medium: string | null
  first_utm_campaign: string | null
  first_utm_content: string | null
  first_utm_term: string | null
  first_gclid: string | null
  first_fbclid: string | null
  first_landing_page: string | null
  first_referrer: string | null
  converting_utm_source: string | null
  converting_utm_medium: string | null
  converting_utm_campaign: string | null
  converting_gclid: string | null
  converting_fbclid: string | null
  converting_landing_page: string | null
}

/**
 * Waterfall first-touch from the visitors table onto a retail lead,
 * and snapshot converting (this-session) UTMs from the form payload.
 */
export async function resolveLeadAttribution(
  admin: SupabaseClient,
  input: LeadAttributionInput
): Promise<LeadAttributionRow> {
  const fingerprint = input.visitor_id?.trim() || null

  let visitor: {
    first_utm_source: string | null
    first_utm_medium: string | null
    first_utm_campaign: string | null
    first_utm_content: string | null
    first_utm_term: string | null
    first_gclid: string | null
    first_fbclid: string | null
    first_landing_page: string | null
    first_referrer: string | null
  } | null = null

  if (fingerprint) {
    const { data } = await admin
      .from('visitors')
      .select(
        'first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_utm_term, first_gclid, first_fbclid, first_landing_page, first_referrer'
      )
      .eq('fingerprint', fingerprint)
      .maybeSingle()
    visitor = data
  }

  return {
    visitor_fingerprint: fingerprint,
    session_id: input.session_id?.trim() || null,
    first_utm_source: visitor?.first_utm_source || input.utm_source || null,
    first_utm_medium: visitor?.first_utm_medium || input.utm_medium || null,
    first_utm_campaign: visitor?.first_utm_campaign || input.utm_campaign || null,
    first_utm_content: visitor?.first_utm_content || input.utm_content || null,
    first_utm_term: visitor?.first_utm_term || input.utm_term || null,
    first_gclid: visitor?.first_gclid || input.gclid || null,
    first_fbclid: visitor?.first_fbclid || input.fbclid || null,
    first_landing_page: visitor?.first_landing_page || input.landing_page || null,
    first_referrer: visitor?.first_referrer || input.referrer || null,
    converting_utm_source: input.utm_source || null,
    converting_utm_medium: input.utm_medium || null,
    converting_utm_campaign: input.utm_campaign || null,
    converting_gclid: input.gclid || null,
    converting_fbclid: input.fbclid || null,
    converting_landing_page: input.landing_page || null,
  }
}
