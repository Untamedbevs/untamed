'use client'

import { Tag } from 'lucide-react'
import { MERGE_TAGS, SAMPLE_LINK_VARS } from '@/lib/email/render'

const GROUPS = ['Person', 'Portal', 'Referral'] as const

/**
 * Clickable merge tags, grouped. Each button shows a friendly name; hovering
 * shows the raw tag and an example value. `target` names the field the tag
 * will go into so staff know where it lands.
 */
export function MergeTagPicker({
  onInsert,
  target,
  note,
}: {
  onInsert: (tag: string) => void
  target?: string
  note?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 text-[11px] text-[#A0A0A0]">
        <span className="flex items-center gap-1.5">
          <Tag className="w-3 h-3" /> Click a tag to insert it
        </span>
        {target && (
          <span>
            into <span className="text-white font-medium">{target}</span>
          </span>
        )}
      </div>
      {GROUPS.map((group) => (
        <div key={group} className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-[#666]">{group}</span>
          {MERGE_TAGS.filter((m) => m.group === group).map((m) => {
            const key = m.tag.slice(2, -2)
            const example = SAMPLE_LINK_VARS[key]
            return (
              <button
                key={m.tag}
                type="button"
                // Keep focus (and the cursor position) in the field being edited.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onInsert(m.tag)}
                title={example ? `${m.tag} → ${example}` : m.tag}
                className="text-xs px-2 py-1 rounded-md bg-[#1A1A1A] text-[#D0D0D0] border border-[#2A2A2A] hover:border-[#9B30FF]/60 hover:bg-[#9B30FF]/10 hover:text-white"
              >
                {m.label}
              </button>
            )
          })}
        </div>
      ))}
      {note && <div className="text-[10px] text-[#666]">{note}</div>}
    </div>
  )
}
