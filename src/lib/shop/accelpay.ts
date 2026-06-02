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

/** Re-scan embed divs after client navigation — AccelPay only auto-attaches on full page load. */
export function scheduleAccelPayRender(delaysMs = [0, 150, 400, 800, 1500, 2500]) {
  return delaysMs.map((ms) => setTimeout(() => renderAccelPay(), ms))
}

export function clearAccelPayRenderSchedule(timers: ReturnType<typeof setTimeout>[]) {
  timers.forEach(clearTimeout)
}

/** Pages that mount AccelPay buy-button embeds */
export function isAccelPayPage(pathname: string) {
  return pathname === '/shop' || pathname.startsWith('/drinks/')
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
 * Open the AccelPay cart sidebar.
 * AccelPay renders a cart button with class "accelpay-view-cart" that,
 * when clicked, triggers its internal iframe cart panel to open.
 * We programmatically click that element from our own nav button.
 */
export function openCart() {
  // Method 1: Click AccelPay's rendered "View Cart" button
  const viewCartBtn = document.querySelector<HTMLElement>('.accelpay-view-cart')
  if (viewCartBtn) {
    viewCartBtn.click()
    return
  }

  // Method 2: Try the bc-cartcount-wrapper (alternate AccelPay class)
  const cartWrapper = document.querySelector<HTMLElement>('.bc-cartcount-wrapper')
  if (cartWrapper) {
    cartWrapper.click()
    return
  }

  // Method 3: Navigate with ?open=true — AccelPay reads this on page load
  const url = new URL(window.location.href)
  url.searchParams.delete('session')
  url.searchParams.set('open', 'true')
  window.location.href = url.toString()
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
