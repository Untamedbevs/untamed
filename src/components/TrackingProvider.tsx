'use client'

import { createContext, useContext, useEffect, useState, Suspense, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import {
  getAttribution,
  initTracking,
  trackEvent,
  trackPageView,
  type AttributionPayload,
  type TrackingIds,
} from '@/lib/tracking/client'

interface TrackingContext extends TrackingIds {
  ready: boolean
  getAttribution: () => AttributionPayload
  trackEvent: (eventType: string, eventData?: Record<string, unknown>) => Promise<void>
  trackPageView: () => Promise<void>
}

const TrackingCtx = createContext<TrackingContext>({
  visitorId: '',
  sessionId: '',
  ready: false,
  getAttribution,
  trackEvent,
  trackPageView,
})

export function useTracking() {
  return useContext(TrackingCtx)
}

function TrackingInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [state, setState] = useState<TrackingIds & { ready: boolean }>({
    visitorId: '',
    sessionId: '',
    ready: false,
  })

  useEffect(() => {
    initTracking().then((ids) => {
      setState({ ...ids, ready: true })
    })
  }, [])

  useEffect(() => {
    if (!state.ready) return
    trackPageView()
  }, [pathname, state.ready])

  return (
    <TrackingCtx.Provider
      value={{
        ...state,
        getAttribution,
        trackEvent,
        trackPageView,
      }}
    >
      {children}
    </TrackingCtx.Provider>
  )
}

export function TrackingProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <TrackingInner>{children}</TrackingInner>
    </Suspense>
  )
}
