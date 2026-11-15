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

/**
 * sessionStorage key set when AddToCart is fired from a cart link (pack
 * builder). AccelPaySaleTracker skips the cart's own add-item messages for a
 * short window after it so one click is not counted twice.
 */
export const LINK_ADD_TO_CART_KEY = 'ut_link_atc_at'
export const LINK_ADD_TO_CART_WINDOW_MS = 20000

/**
 * One AddToCart for a multi-box add from the Pick Your Four page. The cart
 * reports each flavor separately (or not at all for a cart link), so the page
 * sends a single event with the full value instead.
 */
export function trackLinkAddToCart(params: { value: number; contentIds: string[] }): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(LINK_ADD_TO_CART_KEY, String(Date.now()))
  } catch {
    // Storage can be unavailable; tracking still fires.
  }
  if (window.fbq) {
    window.fbq('track', 'AddToCart', {
      value: params.value,
      currency: 'USD',
      content_ids: params.contentIds,
      content_type: 'product',
    })
  }
  if (window.gtag) {
    window.gtag('event', 'add_to_cart', { value: params.value, currency: 'USD' })
  }
}
