'use client'

import { useEffect, useRef } from 'react'
import { scheduleAccelPayRender, clearAccelPayRenderSchedule } from '@/lib/shop/accelpay'

interface AddToCartButtonProps {
  listingId: string
  variantId: string
  color?: string
  colorGlow?: string
  compact?: boolean
}

/**
 * Renders AccelPay's native embed div. We use dangerouslySetInnerHTML
 * to inject the div so React doesn't try to reconcile/wipe AccelPay's
 * rendered button on subsequent renders.
 */
export function AddToCartButton({
  listingId,
  variantId,
  compact = false,
}: AddToCartButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Clear any previous AccelPay button and insert fresh embed div
    el.innerHTML = `<div data-bclistingid="${listingId}" data-bcvariantid="${variantId}"></div>`

    const timers = scheduleAccelPayRender()
    return () => clearAccelPayRenderSchedule(timers)
  }, [listingId, variantId])

  return (
    <div
      ref={containerRef}
      className={compact ? 'accelpay-compact' : ''}
    />
  )
}
