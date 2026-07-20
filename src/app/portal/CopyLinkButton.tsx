'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-[#0A0A0A] rounded-xl px-3 py-2.5 border border-[#2A2A2A] overflow-hidden">
        <span className="text-xs text-[#A0A0A0] truncate font-mono block">
          {link}
        </span>
      </div>
      <button
        onClick={handleCopy}
        className="shrink-0 inline-flex items-center gap-2 rounded-full bg-[#9B30FF] hover:bg-[#7E22CE] transition-colors px-4 py-2.5 text-sm font-semibold text-white"
        title="Copy link"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy
          </>
        )}
      </button>
    </div>
  )
}
