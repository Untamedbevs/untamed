import { cn } from '@/lib/utils'
import './rewards.css'

/** The brand's three claw scratches. `animate` draws them in. */
export function ClawMarks({ className, animate = false }: { className?: string; animate?: boolean }) {
  return (
    <svg
      viewBox="0 0 60 60"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
      className={cn(animate && 'rw-slash', className)}
    >
      <path d="M20 6 L8 54" />
      <path d="M36 4 L22 56" />
      <path d="M52 6 L38 54" />
    </svg>
  )
}
