import Link from 'next/link'
import { Send, Mail } from 'lucide-react'

export default function CrmHomePage() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">CRM</h1>
      <p className="text-[#A0A0A0] mb-8">
        Email and outreach tools for loyalty members, referrers, and distributor leads.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/crm/blast"
          className="group rounded-xl border border-[#2A2A2A] bg-[#111] p-6 hover:border-[#9B30FF]/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-[#9B30FF]/15 text-[#9B30FF] group-hover:bg-[#9B30FF]/25 transition-colors">
              <Send className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">Email Blast</h2>
          </div>
          <p className="text-sm text-[#A0A0A0]">
            Send a campaign to loyalty members, referrers, or distributor leads with audience filters and merge tags.
          </p>
        </Link>

        <div className="rounded-xl border border-[#2A2A2A] bg-[#111] p-6 opacity-60">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-[#A0A0A0]/15 text-[#A0A0A0]">
              <Mail className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">Campaign History</h2>
          </div>
          <p className="text-sm text-[#A0A0A0]">Coming soon. Browse past blasts and per-recipient delivery status.</p>
        </div>
      </div>
    </div>
  )
}
