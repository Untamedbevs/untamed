'use client'

const VISITOR_COOKIE = 'ut_visitor_id'
const SESSION_COOKIE = 'ut_session_id'
const FIRST_TOUCH_COOKIE = 'ut_first_touch'
const VISITOR_TTL_DAYS = 365
const SESSION_TTL_MINUTES = 30
const CLICK_ID_EXPIRY_DAYS = 90
const GOOGLE_CLICK_ID_KEY = 'ut_google_click_ids'
const META_CLICK_ID_KEY = 'ut_meta_click_id'

export interface TrackingIds {
  visitorId: string
  sessionId: string
}

export interface AttributionPayload {
  visitor_id?: string
  session_id?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  gclid?: string
  fbclid?: string
  referrer?: string
  landing_page?: string
}

interface FirstTouch {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  gclid?: string
  fbclid?: string
  referrer?: string
  landing_page?: string
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

export function getVisitorId(): string | null {
  return getCookie(VISITOR_COOKIE)
}

export function getSessionId(): string | null {
  return getCookie(SESSION_COOKIE)
}

function extractUrlParams(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const params: Record<string, string> = {}
  const searchParams = new URLSearchParams(window.location.search)
  searchParams.forEach((value, key) => {
    params[key] = value
  })
  return params
}

function getDeviceInfo(): { type: string; browser: string } {
  const ua = navigator.userAgent
  let type = 'desktop'
  if (/Mobi|Android/i.test(ua)) type = 'mobile'
  else if (/Tablet|iPad/i.test(ua)) type = 'tablet'

  let browser = 'other'
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome'
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'
  else if (/Firefox/i.test(ua)) browser = 'Firefox'
  else if (/Edg/i.test(ua)) browser = 'Edge'

  return { type, browser }
}

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function persistClickIds(urlParams: Record<string, string>) {
  if (typeof window === 'undefined') return
  const expiresAt = Date.now() + CLICK_ID_EXPIRY_DAYS * 86400000
  if (urlParams.gclid || urlParams.gbraid || urlParams.wbraid) {
    localStorage.setItem(
      GOOGLE_CLICK_ID_KEY,
      JSON.stringify({
        gclid: urlParams.gclid || null,
        gbraid: urlParams.gbraid || null,
        wbraid: urlParams.wbraid || null,
        expiresAt,
      })
    )
  }
  if (urlParams.fbclid) {
    localStorage.setItem(
      META_CLICK_ID_KEY,
      JSON.stringify({ fbclid: urlParams.fbclid, expiresAt })
    )
  }
}

function getStoredGoogleClickIds(): { gclid?: string } | null {
  const data = readJson<{ gclid?: string; expiresAt?: number }>(GOOGLE_CLICK_ID_KEY)
  if (!data || (data.expiresAt && data.expiresAt < Date.now())) return null
  return data
}

function getStoredFacebookClickId(): string | undefined {
  const data = readJson<{ fbclid?: string; expiresAt?: number }>(META_CLICK_ID_KEY)
  if (!data || (data.expiresAt && data.expiresAt < Date.now())) return undefined
  return data.fbclid
}

function getFirstTouch(): FirstTouch {
  const raw = getCookie(FIRST_TOUCH_COOKIE)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as FirstTouch
  } catch {
    return {}
  }
}

function persistFirstTouch(urlParams: Record<string, string>) {
  if (getCookie(FIRST_TOUCH_COOKIE)) return
  const first: FirstTouch = {
    utm_source: urlParams.utm_source,
    utm_medium: urlParams.utm_medium,
    utm_campaign: urlParams.utm_campaign,
    utm_content: urlParams.utm_content,
    utm_term: urlParams.utm_term,
    gclid: urlParams.gclid,
    fbclid: urlParams.fbclid,
    referrer: typeof document !== 'undefined' ? document.referrer : undefined,
    landing_page: typeof window !== 'undefined' ? window.location.pathname : undefined,
  }
  if (first.utm_source || first.gclid || first.fbclid || first.referrer) {
    setCookie(FIRST_TOUCH_COOKIE, JSON.stringify(first), VISITOR_TTL_DAYS)
  }
}

export function getAttribution(): AttributionPayload {
  const urlParams = typeof window !== 'undefined' ? extractUrlParams() : {}
  const first = getFirstTouch()
  const google = getStoredGoogleClickIds()
  const fbclid = urlParams.fbclid || getStoredFacebookClickId() || first.fbclid

  return {
    visitor_id: getVisitorId() || undefined,
    session_id: getSessionId() || undefined,
    utm_source: urlParams.utm_source || first.utm_source,
    utm_medium: urlParams.utm_medium || first.utm_medium,
    utm_campaign: urlParams.utm_campaign || first.utm_campaign,
    utm_content: urlParams.utm_content || first.utm_content,
    utm_term: urlParams.utm_term || first.utm_term,
    gclid: urlParams.gclid || google?.gclid || first.gclid,
    fbclid,
    referrer: first.referrer || (typeof document !== 'undefined' ? document.referrer : undefined),
    landing_page: first.landing_page || (typeof window !== 'undefined' ? window.location.pathname : undefined),
  }
}

export async function trackPageView(): Promise<void> {
  const visitorId = getVisitorId()
  const sessionId = getSessionId()
  if (!visitorId || !sessionId || typeof window === 'undefined') return
  try {
    await fetch('/api/tracking/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId,
        sessionId,
        pagePath: window.location.pathname,
        pageTitle: document.title,
        pageUrl: window.location.href,
      }),
    })
  } catch {
    // Tracking should never break the user experience
  }
}

export async function trackEvent(
  eventType: string,
  eventData?: Record<string, unknown>
): Promise<void> {
  const visitorId = getVisitorId()
  const sessionId = getSessionId()
  if (!visitorId || typeof window === 'undefined') return
  try {
    await fetch('/api/tracking/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId,
        sessionId,
        eventType,
        pagePath: window.location.pathname,
        eventData: eventData || {},
      }),
    })
  } catch {
    // Tracking should never break the user experience
  }
}

export async function initTracking(): Promise<TrackingIds> {
  let visitorId = getCookie(VISITOR_COOKIE)
  const isNewVisitor = !visitorId
  if (!visitorId) {
    visitorId = crypto.randomUUID()
    setCookie(VISITOR_COOKIE, visitorId, VISITOR_TTL_DAYS)
  }

  const urlParams = extractUrlParams()
  persistClickIds(urlParams)
  persistFirstTouch(urlParams)

  const hasNewAttribution =
    !!urlParams.utm_source || !!urlParams.gclid || !!urlParams.fbclid

  let sessionId = getCookie(SESSION_COOKIE) || ''
  const isNewSession = !sessionId || hasNewAttribution
  if (isNewSession) {
    sessionId = crypto.randomUUID()
  }
  setCookie(SESSION_COOKIE, sessionId, SESSION_TTL_MINUTES / 1440)

  const device = getDeviceInfo()

  try {
    await fetch('/api/tracking/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId,
        sessionId,
        isNewVisitor,
        isNewSession,
        landingPage: window.location.pathname,
        referrer: document.referrer || '',
        urlParams,
        device,
      }),
    })
  } catch {
    // Tracking should never break the user experience
  }

  return { visitorId, sessionId }
}
