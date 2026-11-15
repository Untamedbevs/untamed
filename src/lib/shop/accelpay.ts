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
  return (
    pathname === '/shop' ||
    pathname.startsWith('/drinks/')
  )
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
 * Build a same-page URL that loads the AccelPay cart with several items at
 * once and opens it. Format (the one AccelPay uses for its own cart links):
 * ?items={"listingId.variantId":qty,...}&open=true
 * Other query params (UTMs, fbclid) are kept so attribution survives the reload.
 */
export function buildItemsCartUrl(items: Record<string, number>): string {
  const keep = new URLSearchParams(window.location.search)
  for (const key of ['items', 'open', 'session', 'mix']) keep.delete(key)
  const prefix = keep.toString()
  const encoded = encodeURI(JSON.stringify(items))
  return `${window.location.pathname}?${prefix ? `${prefix}&` : ''}items=${encoded}&open=true`
}

/** Parse an `items` query value back into { "listingId.variantId": qty }. */
export function parseItemsParam(raw: string | null): Record<string, number> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const [key, qty] of Object.entries(parsed)) {
      const n = Number(qty)
      if (Number.isInteger(n) && n > 0) out[key] = n
    }
    return out
  } catch {
    return {}
  }
}

/**
 * True where the AccelPay cart cannot load: brand.js points the cart frame at
 * the page's own host whenever the hostname contains "localhost", so the frame
 * shows this site's 404 instead of the cart. Opening the dev server as
 * 127.0.0.1 (same port) gets the real cart.
 */
export function isCartBlockedOnLocalhost(): boolean {
  return typeof window !== 'undefined' && window.location.host.includes('localhost')
}

export interface CartLine {
  listingId: string
  variantId: string
  qty: number
}

/**
 * Add several items to the AccelPay cart without leaving the page, by posting
 * the same `bc-add` message brand.js sends from its own buttons (with a
 * quantity) to the cart iframe. Items are ADDED to whatever is already in the
 * cart. Resolves true once the cart confirms (`bc-add-item`, or a `bc-update`
 * reporting a non-empty cart), false if the iframe is missing or stays silent,
 * so the caller can fall back to a cart link. The cart can take a few seconds
 * to answer on a slow connection, hence the long timeout.
 * This message format is not a documented AccelPay API; the fallback covers a
 * future change to it.
 */
export function addItemsToCart(lines: CartLine[], timeoutMs = 12000): Promise<boolean> {
  return new Promise((resolve) => {
    const iframe = document.getElementById('accelpay-iframe') as HTMLIFrameElement | null
    const target = iframe?.contentWindow
    let origin = ''
    try {
      origin = iframe?.src ? new URL(iframe.src).origin : ''
    } catch {
      origin = ''
    }
    if (!target || !origin || lines.length === 0) {
      resolve(false)
      return
    }

    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      window.removeEventListener('message', onMessage)
      clearTimeout(timer)
      resolve(ok)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return
      const action = event.data?.action
      if (action === 'bc-add-item' || (action === 'bc-update' && Number(event.data.value) > 0)) finish(true)
    }
    const timer = setTimeout(() => finish(false), timeoutMs)
    window.addEventListener('message', onMessage)

    for (const line of lines) {
      target.postMessage({ action: 'bc-add', key: line.listingId, meta: line.variantId, value: line.qty }, origin)
    }
  })
}

/** Slide out the AccelPay side cart. Returns false if its trigger isn't on the page. */
export function openSideCart(): boolean {
  const trigger =
    document.querySelector<HTMLElement>('.accelpay-view-cart') ||
    document.querySelector<HTMLElement>('.bc-cartcount-wrapper')
  if (!trigger) return false
  trigger.click()
  return true
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
