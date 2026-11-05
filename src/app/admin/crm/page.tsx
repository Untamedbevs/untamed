import Link from 'next/link'
import { Send, ListChecks, FileText, Users } from 'lucide-react'

const CARDS = [
  {
    href: '/admin/crm/blast',
    icon: Send,
    title: 'Email Blast',
    body: 'Compose a campaign, pick a template and segment, preview it, send yourself a test, then send now or schedule it.',
  },
  {
    href: '/admin/crm/campaigns',
    icon: ListChecks,
    title: 'Campaigns',
    body: 'Every blast with live send progress. Cancel scheduled or in-flight campaigns.',
  },
  {
    href: '/admin/crm/templates',
    icon: FileText,
    title: 'Templates',
    body: 'Reusable campaign emails, plus transactional emails (e.g. from orders@) that code sends by slug.',
  },
  {
    href: '/admin/crm/segments',
    icon: Users,
    title: 'Segments',
    body: 'Saved audiences built from loyalty, referral and distributor filters.',
  },
]

export default function CrmHomePage() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">CRM</h1>
      <p className="text-[#A0A0A0] mb-8">
        Email for loyalty members, referrers, and distributor leads, sent through Google Workspace.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CARDS.map(({ href, icon: Icon, title, body }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-[#2A2A2A] bg-[#111] p-6 hover:border-[#9B30FF]/50 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-[#9B30FF]/15 text-[#9B30FF] group-hover:bg-[#9B30FF]/25 transition-colors">
                <Icon className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
            </div>
            <p className="text-sm text-[#A0A0A0]">{body}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
