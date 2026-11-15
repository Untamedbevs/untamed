'use client'

import { useEffect } from 'react'
import { REF_COOKIE_NAME } from '@/lib/referral/constants'
import { LINK_ADD_TO_CART_KEY, LINK_ADD_TO_CART_WINDOW_MS } from '@/lib/tracking/meta-pixel'

const VISITOR_COOKIE = 'ut_visitor_id'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

const META_CLICK_ID_KEY = 'ut_meta_click_id'
const CLICK_ID_EXPIRY_MS = 90 * 86400000

/** Rebuild `_fbc` from the fbclid `initTracking` stored, if the Pixel never set it. */
function fbcFromStoredClick(): string | null {
  try {
    const raw = localStorage.getItem(META_CLICK_ID_KEY)
    if (!raw) return null
    const { fbclid, expiresAt } = JSON.parse(raw) as { fbclid?: string; expiresAt?: number }
    if (!fbclid || !expiresAt || expiresAt < Date.now()) return null
    return `fb.1.${expiresAt - CLICK_ID_EXPIRY_MS}.${fbclid}`
  } catch {
    return null
  }
}

/**
 * Browser Pixel events for the AccelPay cart funnel. AccelPay's own Meta
 * integration stays off (its Purchase would double-count our server-side CAPI
 * Purchase), so AddToCart and InitiateCheckout are sent from here. Payload
 * shape mirrors AccelPay's handler: amounts are integer cents.
 */
function trackCartEvent(name: 'AddToCart' | 'InitiateCheckout', value: any): void {
  try {
    if (typeof window.fbq !== 'function') return
    const params: Record<string, unknown> = {}
    const subtotal = Number(value?.estimate?.subtotal)
    if (Number.isFinite(subtotal) && subtotal > 0) {
      params.value = subtotal / 100
      params.currency = 'USD'
    }
    const ids = Array.isArray(value?.items)
      ? value.items.map((i: any) => i?.variant?.id).filter(Boolean).map(String)
      : []
    if (ids.length) {
      params.content_ids = ids
      params.content_type = 'product'
    }
    window.fbq('track', name, params)
  } catch {
    // Tracking must never break the cart.
  }
}

/** True right after the pack builder already sent AddToCart for a cart link. */
function linkAddJustTracked(): boolean {
  try {
    const at = Number(sessionStorage.getItem(LINK_ADD_TO_CART_KEY))
    return Number.isFinite(at) && at > 0 && Date.now() - at < LINK_ADD_TO_CART_WINDOW_MS
  } catch {
    return false
  }
}

/**
 * Captures AccelPay order attribution. The AccelPay cart (an iframe) fires a
 * `bc-sale` postMessage when a purchase completes; at that moment the browser
 * still holds the `ut_visitor_id` (base/UTM) and `ut_ref` (referral) cookies
 * plus the AccelPay sale id -- none of which are in the server-side order
 * webhook. We forward them to /api/tracking/attribute-order so the order can be
 * tied to its marketing source and referrer. Mounted globally because checkout
 * can complete from any page.
 */
export function AccelPaySaleTracker() {
  useEffect(() => {
    const seen = new Set<number>()
    let lastCheckoutAt = 0

    function handleMessage(event: MessageEvent) {
      const data = event.data
      if (typeof data !== 'object' || !data?.action) return

      if (data.action === 'bc-add-item') {
        if (!linkAddJustTracked()) trackCartEvent('AddToCart', data.value)
        return
      }
      if (data.action === 'bc-begin-checkout') {
        // The cart can post this more than once per checkout attempt.
        const now = Date.now()
        if (now - lastCheckoutAt > 5000) trackCartEvent('InitiateCheckout', data.value)
        lastCheckoutAt = now
        return
      }
      if (data.action !== 'bc-sale') return

      const saleId = Number(data.value?.payload?.id)
      if (!Number.isFinite(saleId) || saleId <= 0 || seen.has(saleId)) return
      seen.add(saleId)

      const visitorId = readCookie(VISITOR_COOKIE)
      const refCode = readCookie(REF_COOKIE_NAME)
      const fbp = readCookie('_fbp')
      const fbc = readCookie('_fbc') || fbcFromStoredClick()

      // Fire on every sale: the Meta Purchase needs this browser context even
      // without UTM or referral attribution.
      const payload: Record<string, unknown> = { saleId, pageUrl: window.location.href }
      if (visitorId) payload.visitorId = visitorId
      if (refCode) payload.refCode = refCode
      if (fbp) payload.fbp = fbp
      if (fbc) payload.fbc = fbc

      try {
        fetch('/api/tracking/attribute-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {})
      } catch {
        // Attribution must never break checkout.
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return null
}
