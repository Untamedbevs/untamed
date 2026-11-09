import Link from 'next/link'
import { Send, Mail, Users, BarChart3, Workflow, LayoutTemplate, Settings } from 'lucide-react'

const CARDS = [
  {
    href: '/admin/crm/email',
    icon: BarChart3,
    title: 'Email dashboard',
    body: 'Deliverability, alerts, campaign results with attributed revenue, flow performance, and list growth.',
  },
  {
    href: '/admin/crm/contacts',
    icon: Users,
    title: 'Contacts',
    body: 'Every email address you hold, what each person agreed to receive, and the proof. Record opt-ins, honor opt-outs, and handle data requests.',
  },
  {
    href: '/admin/crm/blast',
    icon: Send,
    title: 'New campaign',
    body: 'Send to people who opted in to a list, or the one-time permission request. Templates, scheduling, segments, and approvals.',
  },
  {
    href: '/admin/crm/email/flows',
    icon: Workflow,
    title: 'Automated flows',
    body: 'Welcome series, after-order and reorder, win-back, referral credit to redemption, points reminders, birthdays.',
  },
  {
    href: '/admin/crm/email/templates',
    icon: LayoutTemplate,
    title: 'Templates',
    body: 'Reusable email designs for campaigns, flows, and outreach.',
  },
  {
    href: '/admin/crm/outreach',
    icon: Mail,
    title: 'Outreach',
    body: 'One-to-one emails and follow-up sequences sent from your own mailbox, stopped automatically when someone replies.',
  },
  {
    href: '/admin/crm/email/settings',
    icon: Settings,
    title: 'Email settings',
    body: 'Kill switch, frequency cap, quiet hours, sunset, approvals, auto-pause thresholds, retention, and staff activity.',
  },
]

export default function CrmHomePage() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">CRM</h1>
      <p className="text-[#A0A0A0] mb-8">
        Email, consent, and outreach for customers, loyalty members, referrers, and wholesale leads.
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
