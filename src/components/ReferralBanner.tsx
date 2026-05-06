'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'

export function ReferralBanner() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return

    const refCode = searchParams.get('ref')
    if (!refCode) return

    tracked.current = true

    const type = pathname.startsWith('/retail') ? 'distributor' : 'consumer'

    fetch('/api/referral/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: refCode, type }),
    }).catch(() => {
      // silently fail -- tracking is best-effort
    })
  }, [searchParams, pathname])

  return null
}
