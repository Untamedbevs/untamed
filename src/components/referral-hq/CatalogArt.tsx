import Image from 'next/image'
import { CupSoda } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Reward } from '@/lib/loyalty/constants'
import { CATALOG_ART } from '@/lib/referral-hq/program'

/** Art for a catalog reward, or a branded icon tile where no art exists yet. */
export function CatalogArt({
  rewardId,
  size,
  dim = false,
  className,
}: {
  rewardId: Reward['id']
  size: number
  /** Grayed out, for rewards still out of reach. */
  dim?: boolean
  className?: string
}) {
  const src = CATALOG_ART[rewardId]
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className={cn('object-contain shrink-0', dim && 'grayscale opacity-50', className)}
      />
    )
  }
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-2xl border border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/[0.14] to-[#9B30FF]/[0.10]',
        dim && 'grayscale opacity-50',
        className
      )}
      aria-hidden
    >
      <CupSoda className="h-1/2 w-1/2 text-[#FFD700]" strokeWidth={1.5} />
    </span>
  )
}
