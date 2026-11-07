'use client'

import type { EmailLayout } from '@/lib/email/render'
import { cn } from '@/lib/utils'

const OPTIONS: { value: EmailLayout; label: string; hint: string }[] = [
  { value: 'plain', label: 'Plain', hint: 'Reads like a personal email' },
  { value: 'branded', label: 'Branded card', hint: 'Dark card with the Untamed header' },
]

/** Two-way switch for an email's look. */
export function EmailLayoutPicker({
  value,
  onChange,
}: {
  value: EmailLayout
  onChange: (layout: EmailLayout) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'text-left px-3 py-2 rounded-lg border text-sm',
            value === o.value
              ? 'border-[#9B30FF] bg-[#9B30FF]/10 text-white'
              : 'border-[#2A2A2A] bg-[#0A0A0A] text-[#A0A0A0] hover:text-white hover:border-[#444]'
          )}
        >
          <span className="block font-medium">{o.label}</span>
          <span className="block text-[11px] text-[#888]">{o.hint}</span>
        </button>
      ))}
    </div>
  )
}

/** Preview frame background that matches how the layout looks in a mail app. */
export function previewFrameBg(layout: EmailLayout): string {
  return layout === 'plain' ? 'bg-white' : 'bg-[#0A0A0A]'
}
