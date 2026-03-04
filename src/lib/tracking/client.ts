'use client'

const VISITOR_COOKIE = 'ut_visitor_id'
const SESSION_COOKIE = 'ut_session_id'
const VISITOR_TTL_DAYS = 365
const SESSION_TTL_MINUTES = 30

export interface TrackingIds {
  visitorId: string
  sessionId: string
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

export async function initTracking(): Promise<TrackingIds> {
  let visitorId = getCookie(VISITOR_COOKIE)
  const isNewVisitor = !visitorId
  if (!visitorId) {
    visitorId = crypto.randomUUID()
    setCookie(VISITOR_COOKIE, visitorId, VISITOR_TTL_DAYS)
  }

  const urlParams = extractUrlParams()
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
