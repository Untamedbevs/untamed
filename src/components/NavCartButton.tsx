'use client'

import { useEffect, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { openCart, useCartCount } from '@/lib/shop/accelpay'

interface NavCartButtonProps {
  className: string
  badgeClassName: string
}

export function NavCartButton({ className, badgeClassName }: NavCartButtonProps) {
  const cartCount = useCartCount()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <button
      type="button"
      onClick={openCart}
      className={className}
      aria-label="Open cart"
    >
      <ShoppingCart className="w-5 h-5" />
      {mounted && cartCount > 0 && (
        <span className={badgeClassName}>{cartCount}</span>
      )}
    </button>
  )
}
