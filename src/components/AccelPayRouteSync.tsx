'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  clearAccelPayRenderSchedule,
  isAccelPayPage,
  scheduleAccelPayRender,
} from '@/lib/shop/accelpay'

export function AccelPayRouteSync() {
  const pathname = usePathname()

  useEffect(() => {
    if (!isAccelPayPage(pathname)) return

    const timers = scheduleAccelPayRender()
    return () => clearAccelPayRenderSchedule(timers)
  }, [pathname])

  return null
}
