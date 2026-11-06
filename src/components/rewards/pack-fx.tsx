'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import './portal.css'

/** Glowing embers drifting up the screen. Positions are fixed so server and client render match. */
export function Embers({ count = 18, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {Array.from({ length: count }, (_, i) => {
        const left = (i * 37) % 100
        const style = {
          left: `${left}%`,
          ['--d' as string]: `${6 + (i % 5) * 1.6}s`,
          ['--delay' as string]: `${(i * 0.7) % 6}s`,
          ['--x' as string]: `${((i % 7) - 3) * 18}px`,
          transform: `scale(${0.5 + (i % 4) * 0.25})`,
        }
        return <span key={i} className="pk-ember" style={style} />
      })}
    </div>
  )
}

/** Three claw slashes drawn across the whole screen, with a flash. Mount it to play it once. */
export function ClawSlash({ color = '#FFD700' }: { color?: string }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80]">
      <div className="pk-flash absolute inset-0" style={{ background: `radial-gradient(60% 60% at 50% 50%, ${color}55, transparent 70%)` }} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pk-claw absolute inset-0 h-full w-full">
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M ${18 + i * 18} -5 Q ${30 + i * 18} 50 ${62 + i * 18} 105`}
            pathLength={1}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px ${color})` }}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  )
}

/**
 * Picks one of three type sizes by name length, so a member's name in the big
 * brush script always fits on its line. Pass the classes for short, medium and long.
 */
export function fitName(name: string | null | undefined, sizes: [string, string, string]): string {
  const length = (name ?? '').length
  return length <= 8 ? sizes[0] : length <= 14 ? sizes[1] : sizes[2]
}

/** Counts up from 0 to the target once `run` is true. */
export function useCountUp(target: number, run = true, duration = 1400): number {
  const [value, setValue] = useState(run ? 0 : target)
  useEffect(() => {
    if (!run) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, run, duration])
  return value
}

/**
 * The Pack gate: two doors with the brand crest on the seam. `open` parts
 * them; render it closed and flip `open` to play the reveal.
 */
export function Gate({ open, accent, label }: { open: boolean; accent: string; label?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none fixed inset-0 z-[90] overflow-hidden', open && 'pk-gate-open')}
      style={{ ['--pk-accent' as string]: accent }}
    >
      <div className="pk-door pk-door-left" />
      <div className="pk-door pk-door-right" />
      <div className="pk-gate-seam" />
      <div className="pk-gate-crest absolute inset-0 flex flex-col items-center justify-center">
        <div className="relative h-24 w-24">
          <div className="pk-ring absolute inset-0 rounded-full opacity-80 blur-md" />
          <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-black">
            <Image src="/images/logo-mark.png" alt="" width={56} height={56} className="object-contain" />
          </div>
        </div>
        {label && <div className="mt-5 text-xs font-semibold uppercase tracking-[0.4em] text-[#FFD700]">{label}</div>}
      </div>
    </div>
  )
}
