'use client'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

interface LeadParams {
  eventID: string
  content_name?: string
  content_category?: string
  value?: number
  currency?: string
}

export function trackLead(params: LeadParams): void {
  if (typeof window === 'undefined') return

  if (window.fbq) {
    window.fbq(
      'track',
      'Lead',
      {
        content_name: params.content_name,
        content_category: params.content_category,
        value: params.value,
        currency: params.currency || 'USD',
      },
      { eventID: params.eventID }
    )
  }

  if (window.gtag) {
    window.gtag('event', 'generate_lead', {
      event_id: params.eventID,
      content_name: params.content_name,
      content_category: params.content_category,
      value: params.value,
      currency: params.currency || 'USD',
    })
  }

  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  const adsLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL
  if (window.gtag && adsId && adsLabel) {
    window.gtag('event', 'conversion', {
      send_to: `${adsId}/${adsLabel}`,
      event_id: params.eventID,
    })
  }
}
