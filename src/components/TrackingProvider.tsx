'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { initTracking, type TrackingIds } from '@/lib/tracking/client'

interface TrackingContext extends TrackingIds {
  ready: boolean
}

const TrackingCtx = createContext<TrackingContext>({
  visitorId: '',
  sessionId: '',
  ready: false,
})

export function useTracking() {
  return useContext(TrackingCtx)
}

export function TrackingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TrackingContext>({
    visitorId: '',
    sessionId: '',
    ready: false,
  })

  useEffect(() => {
    initTracking().then((ids) => {
      setState({ ...ids, ready: true })
    })
  }, [])

  return <TrackingCtx.Provider value={state}>{children}</TrackingCtx.Provider>
}
