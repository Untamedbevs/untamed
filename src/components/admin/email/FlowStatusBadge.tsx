import { cn } from '@/lib/utils'

export function FlowStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'text-green-400 bg-green-400/10',
    paused: 'text-amber-300 bg-amber-400/10',
    draft: 'text-[#A0A0A0] bg-[#1A1A1A]',
    unavailable: 'text-[#666] bg-[#1A1A1A]',
  }
  return (
    <span className={cn('text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded', map[status] || map.draft)}>{status}</span>
  )
}
