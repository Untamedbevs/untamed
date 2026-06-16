'use client'

import { useEffect } from 'react'
import { REF_COOKIE_NAME } from '@/lib/referral/constants'

const VISITOR_COOKIE = 'ut_visitor_id'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
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

    function handleMessage(event: MessageEvent) {
      const data = event.data
      if (
        typeof data !== 'object' ||
        !data?.action ||
        data.action !== 'bc-sale'
      ) {
        return
      }

      const saleId = Number(data.value?.payload?.id)
      if (!Number.isFinite(saleId) || saleId <= 0 || seen.has(saleId)) return
      seen.add(saleId)

      const visitorId = readCookie(VISITOR_COOKIE)
      const refCode = readCookie(REF_COOKIE_NAME)
      // Fire on every sale: UTM attribution applies even without a referral.
      if (!visitorId && !refCode) return

      const payload: Record<string, unknown> = { saleId }
      if (visitorId) payload.visitorId = visitorId
      if (refCode) payload.refCode = refCode

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
