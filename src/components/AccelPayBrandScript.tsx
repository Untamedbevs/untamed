'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { isPrivateEmailPath } from '@/lib/email/private-paths'

/** AccelPay cart embed; skipped on email-link pages (see private-paths). */
export function AccelPayBrandScript() {
  const pathname = usePathname()
  if (isPrivateEmailPath(pathname)) return null
  return <Script src="https://cart.accelpay.io/scripts/brand.js" strategy="afterInteractive" />
}
