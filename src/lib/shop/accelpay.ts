'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * AccelPay/BevCart works via:
 * 1. Embed divs: <div data-bclistingid="X" data-bcvariantid="Y"></div>
 *    The brand.js script scans for these and renders buy buttons inside them.
 * 2. URL params: ?session=BASE64&open=true to pre-load cart items.
 * 3. apRender() to re-scan for new embed divs after client navigation.
 */

interface AccelPayWindow {
  apRender?: () => void
}

function getAP(): AccelPayWindow {
  return typeof window !== 'undefined' ? (window as unknown as AccelPayWindow) : {}
}

export function renderAccelPay() {
  const ap = getAP()
  if (typeof ap.apRender === 'function') {
    ap.apRender()
  }
}

/**
 * Build a URL that adds an item to the AccelPay cart and opens it.
 * Format: ?session=BASE64({listingId.variantId: qty})&open=true
 */
export function buildCartUrl(listingId: string, variantId: string, qty = 1): string {
  const payload = JSON.stringify({ [`${listingId}.${variantId}`]: qty })
  const encoded = typeof window !== 'undefined'
    ? btoa(payload)
    : Buffer.from(payload).toString('base64')
  return `?session=${encoded}&open=true`
}

/**
 * Add item to cart by navigating with the session param.
 * This triggers AccelPay's cart sidebar to open with the item.
 */
export function addToCart(listingId: string, variantId: string, qty = 1) {
  const params = buildCartUrl(listingId, variantId, qty)
  window.location.href = window.location.pathname + params
}

/**
 * Track cart item count by listening to AccelPay postMessage events.
 */
export function useCartCount() {
  const [count, setCount] = useState(0)

  const handleMessage = useCallback((event: MessageEvent) => {
    const data = event.data
    if (typeof data !== 'object' || !data?.action || !/^bc-/.test(data.action)) return

    if (data.value?.items) {
      setCount(data.value.items.length)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  return count
}
