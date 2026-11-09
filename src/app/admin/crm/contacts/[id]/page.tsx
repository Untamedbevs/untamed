'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  History,
  Mail,
  Download,
  Trash2,
  Ban,
  Send,
  ListPlus,
  MessagesSquare,
  ShoppingBag,
  Gift,
  Workflow,
  Reply,
  ArrowUpRight,
  ArrowDownLeft,
  CircleStop,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ListInfo {
  slug: string
  name: string
  audience: string
  requires_age_verification: boolean
  is_active: boolean
}

interface ConversationMessage {
  id: string
  subject: string
  direction: 'inbound' | 'outbound'
  from_email: string
  to_email: string
  body_text: string | null
  status: string
  stream: string | null
  transport: string | null
  sent_at: string
  gmail_thread_id: string | null
  mailbox: string | null
  sent_by_name: string | null
  outreach_enrollment_id: string | null
}

interface OutreachEnrollment {
  id: string
  sequence_id: string
  sequence_name: string
  total_steps: number
  status: string
  next_step: number
  next_run_at: string | null
  last_sent_at: string | null
  sender_email: string
  sender_name: string | null
  stopped_reason: string | null
  created_at: string
}

interface Timeline {
  orders: {
    id: string
    sale_id: number
    created_at: string
    status: string | null
    total_cents: number
    items: { title: string; quantity: number }[]
  }[]
  loyalty: {
    member_id: string
    points_balance: number
    member_since: string
    transactions: { id: string; points: number; type: string; description: string | null; created_at: string }[]
    redemptions: {
      id: string
      reward_label: string
      points_cost: number
      status: string
      created_at: string
      fulfilled_at: string | null
      cancelled_at: string | null
    }[]
  } | null
  flows: {
    id: string
    flow_slug: string
    flow_name: string
    status: string
    steps_sent: number
    next_step_order: number | null
    next_run_at: string | null
    exit_reason: string | null
    enrolled_at: string
    completed_at: string | null
  }[]
  outreach: OutreachEnrollment[]
  conversation: ConversationMessage[]
  sequences: { id: string; name: string; steps: number }[]
}

interface ContactDetail {
  contact: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    sources: string[]
    first_source: string | null
    loyalty_member_id: string | null
    referral_participant_id: string | null
    distributor_lead_id: string | null
    influencer_lead_id: string | null
    age_verified_at: string | null
    age_verification_method: string | null
    country_code: string | null
    repermission_sent_at: string | null
    created_at: string
    order_count?: number | null
    total_spent_cents?: number | null
    first_order_at?: string | null
    last_order_at?: string | null
  }
  lists: ListInfo[]
  consents: { list_slug: string; status: string; subscribed_at: string | null; unsubscribed_at: string | null }[]
  events: {
    id: string
    list_slug: string | null
    action: string
    source: string
    source_detail: string | null
    consent_text: string | null
    consent_text_version: string | null
    ip_address: string | null
    user_agent: string | null
    country_code: string | null
    actor_name: string | null
    evidence_note: string | null
    created_at: string
  }[]
  suppression: { reason: string; notes: string | null; created_at: string } | null
  messages: {
    id: string
    subject: string
    status: string
    stream: string | null
    template_slug: string | null
    sent_at: string
  }[]
  permissions: { canManage: boolean }
  timeline: Timeline
  me: { email: string; full_name: string }
  gmail: { configured: boolean }
}

const ACTION_LABELS: Record<string, string> = {
  opt_in: 'Opted in',
  opt_out: 'Opted out',
  unsubscribe_all: 'Unsubscribed from all',
  complaint: 'Marked as spam',
  hard_bounce: 'Address bounced',
  age_verified: 'Confirmed 21+',
}

const SOURCE_LABELS: Record<string, string> = {
  repermission_email: 'Permission request',
  signup_form: 'Signup form',
  checkout: 'Checkout',
  preference_page: 'Preference page',
  unsubscribe_link: 'Unsubscribe link',
  one_click: 'Mail app one-click',
  mailto: 'Unsubscribe email',
  ses_feedback: 'Amazon SES',
  admin: 'Staff',
  import: 'Import',
}

const TRANSACTION_LABELS: Record<string, string> = {
  referral_signup: 'Referral credit: friend signed up',
  referral_purchase: 'Referral credit: friend ordered',
  online_order: 'Online order',
  redemption: 'Redeemed',
  receipt_approved: 'Receipt approved',
  signup_bonus: 'Signup bonus',
  ugc_approved: 'Content approved',
  adjustment: 'Adjustment',
}

function money(cents: number | null | undefined): string {
  return ((cents || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function day(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function when(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : '—'
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === 'active' || status === 'pending'
      ? 'bg-[#9B30FF]/15 text-[#C792FF]'
      : status === 'replied' || status === 'fulfilled' || status === 'completed'
        ? 'bg-emerald-500/10 text-emerald-400'
        : status === 'stopped' || status === 'exited' || status === 'cancelled' || status === 'suppressed' || status === 'bounced'
          ? 'bg-orange-500/10 text-orange-400'
          : 'bg-[#2A2A2A] text-[#A0A0A0]'
  return <span className={cn('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full', tone)}>{status.replace(/_/g, ' ')}</span>
}

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [data, setData] = useState<ContactDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<'none' | 'compose' | 'sequence'>('none')
  const [replyTo, setReplyTo] = useState<{ messageId: string; subject: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/crm/contacts/${id}`)
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Could not load contact')
      else {
        setData(json)
        setError(null)
      }
    } catch {
      setError('Could not load contact')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (error && !data) {
    return (
      <div className="max-w-5xl mx-auto">
        <BackLink />
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="max-w-5xl mx-auto py-20 text-center text-[#A0A0A0]">
        <Loader2 className="w-6 h-6 animate-spin inline" />
      </div>
    )
  }

  const { contact, lists, consents, events, suppression, messages, permissions, timeline, me, gmail } = data
  const consentByList = new Map(consents.map((c) => [c.list_slug, c]))
  const listNames = new Map(lists.map((l) => [l.slug, l.name]))
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ')

  function startReply(messageId: string, subject: string) {
    setReplyTo({ messageId, subject: /^re:/i.test(subject) ? subject : `Re: ${subject}` })
    setPanel('compose')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <BackLink />

      <div className="rounded-xl border border-[#2A2A2A] bg-[#111] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white break-all">{contact.email}</h1>
            {name && <p className="text-sm text-[#A0A0A0]">{name}</p>}
          </div>
          {suppression && (
            <span className="text-xs px-2 py-1 rounded-full bg-orange-500/10 text-orange-400 flex items-center gap-1">
              <Ban className="w-3 h-3" /> Suppressed: {suppression.reason.replace('_', ' ')}
            </span>
          )}
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <Field label="Found in" value={contact.sources.join(', ') || '—'} />
          <Field label="Contact since" value={new Date(contact.created_at).toLocaleDateString()} />
          <Field
            label="21+ confirmed"
            value={
              contact.age_verified_at
                ? `${new Date(contact.age_verified_at).toLocaleDateString()} (${(contact.age_verification_method || '').replace(/_/g, ' ')})`
                : 'No'
            }
          />
          <Field label="Country" value={contact.country_code || 'Unknown'} />
          <Field
            label="Permission request"
            value={contact.repermission_sent_at ? `Sent ${new Date(contact.repermission_sent_at).toLocaleDateString()}` : 'Not sent'}
          />
          <Field
            label="Linked records"
            value={
              [
                contact.loyalty_member_id && 'Loyalty',
                contact.referral_participant_id && 'Referral',
                contact.distributor_lead_id && 'Wholesale lead',
                contact.influencer_lead_id && 'Creator',
              ]
                .filter(Boolean)
                .join(', ') || '—'
            }
          />
        </dl>
        {suppression?.notes && <p className="text-xs text-[#666] mt-3">Suppression note: {suppression.notes}</p>}

        <div className="mt-4 border-t border-[#2A2A2A] pt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setReplyTo(null)
              setPanel(panel === 'compose' ? 'none' : 'compose')
            }}
            disabled={!!suppression}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-[#9B30FF] text-white hover:bg-[#8A20EE] disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" /> Send email
          </button>
          <button
            onClick={() => setPanel(panel === 'sequence' ? 'none' : 'sequence')}
            disabled={!!suppression}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-[#9B30FF]/50 text-[#C792FF] hover:bg-[#9B30FF]/10 disabled:opacity-40"
          >
            <ListPlus className="w-3.5 h-3.5" /> Add to sequence
          </button>
          {suppression && <span className="text-xs text-[#666]">Suppressed addresses can&apos;t be emailed.</span>}
        </div>

        {panel === 'compose' && !suppression && (
          <Composer
            contactId={contact.id}
            to={contact.email}
            from={me.email}
            gmailConfigured={gmail.configured}
            replyTo={replyTo}
            onClose={() => {
              setPanel('none')
              setReplyTo(null)
            }}
            onSent={() => {
              setPanel('none')
              setReplyTo(null)
              load()
            }}
          />
        )}
        {panel === 'sequence' && !suppression && (
          <AddToSequence
            contactId={contact.id}
            sequences={timeline.sequences}
            enrolledSequenceIds={timeline.outreach.map((e) => e.sequence_id)}
            from={me.email}
            gmailConfigured={gmail.configured}
            onDone={load}
            onClose={() => setPanel('none')}
          />
        )}
      </div>

      <Section title="Conversation" icon={<MessagesSquare className="w-4 h-4" />}>
        <Conversation messages={timeline.conversation} onReply={startReply} canReply={!suppression} />
      </Section>

      <Section title="Outreach" icon={<Send className="w-4 h-4" />}>
        <OutreachList enrollments={timeline.outreach} onChanged={load} />
      </Section>

      <Section title="Previous orders" icon={<ShoppingBag className="w-4 h-4" />}>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
          <Field label="Orders" value={String(contact.order_count ?? timeline.orders.length)} />
          <Field label="Total spent" value={money(contact.total_spent_cents ?? timeline.orders.reduce((s, o) => s + (o.total_cents || 0), 0))} />
          <Field label="Last order" value={day(contact.last_order_at ?? timeline.orders[0]?.created_at)} />
          <Field label="First order" value={day(contact.first_order_at ?? timeline.orders[timeline.orders.length - 1]?.created_at)} />
        </dl>
        {timeline.orders.length === 0 ? (
          <p className="text-sm text-[#666]">No orders found for this address.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {timeline.orders.map((o) => (
                <tr key={o.id} className="border-b border-[#1A1A1A] last:border-0 align-top">
                  <td className="py-2 pr-3 text-xs text-[#A0A0A0] whitespace-nowrap">{day(o.created_at)}</td>
                  <td className="py-2 pr-3 text-white">
                    {o.items.length > 0 ? o.items.map((it) => `${it.title}${it.quantity > 1 ? ` × ${it.quantity}` : ''}`).join(', ') : `Order #${o.sale_id}`}
                  </td>
                  <td className="py-2 pr-3 text-white whitespace-nowrap">{money(o.total_cents)}</td>
                  <td className="py-2 text-xs text-[#A0A0A0]">{o.status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Points & redemptions" icon={<Gift className="w-4 h-4" />}>
        {!timeline.loyalty ? (
          <p className="text-sm text-[#666]">Not a loyalty member.</p>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Field label="Points balance" value={timeline.loyalty.points_balance.toLocaleString('en-US')} />
              <Field label="Member since" value={day(timeline.loyalty.member_since)} />
              <Field
                label="Referral credits"
                value={String(timeline.loyalty.transactions.filter((t) => t.type.startsWith('referral_') && t.points > 0).length)}
              />
              <Field label="Redemptions" value={String(timeline.loyalty.redemptions.length)} />
            </dl>
            {timeline.loyalty.redemptions.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1">Redemptions</div>
                <ul className="space-y-1">
                  {timeline.loyalty.redemptions.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm">
                      <span className="text-white">
                        {r.reward_label} <span className="text-xs text-[#666]">({r.points_cost.toLocaleString('en-US')} pts)</span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-[#666]">
                        {day(r.created_at)}
                        <StatusChip status={r.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {timeline.loyalty.transactions.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#666] mb-1">Recent points activity</div>
                <table className="w-full text-sm">
                  <tbody>
                    {timeline.loyalty.transactions.map((t) => (
                      <tr key={t.id} className="border-b border-[#1A1A1A] last:border-0">
                        <td className="py-1.5 pr-3 text-xs text-[#A0A0A0] whitespace-nowrap">{day(t.created_at)}</td>
                        <td className="py-1.5 pr-3">
                          <span className={cn('text-white', t.type.startsWith('referral_') && 'text-[#C792FF]')}>
                            {TRANSACTION_LABELS[t.type] || t.type}
                          </span>
                          {t.description && <span className="text-xs text-[#666]"> · {t.description}</span>}
                        </td>
                        <td className={cn('py-1.5 text-right whitespace-nowrap', t.points >= 0 ? 'text-emerald-400' : 'text-orange-400')}>
                          {t.points >= 0 ? '+' : ''}
                          {t.points.toLocaleString('en-US')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Automated flows" icon={<Workflow className="w-4 h-4" />}>
        {timeline.flows.length === 0 ? (
          <p className="text-sm text-[#666]">Not in any automated flow.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {timeline.flows.map((f) => (
                <tr key={f.id} className="border-b border-[#1A1A1A] last:border-0">
                  <td className="py-2 pr-3 text-white">{f.flow_name}</td>
                  <td className="py-2 pr-3">
                    <StatusChip status={f.status} />
                  </td>
                  <td className="py-2 pr-3 text-xs text-[#A0A0A0]">
                    {f.steps_sent} sent
                    {f.status === 'active' && f.next_run_at ? ` · next ${when(f.next_run_at)}` : ''}
                    {f.exit_reason ? ` · ${f.exit_reason}` : ''}
                  </td>
                  <td className="py-2 text-xs text-[#666] whitespace-nowrap">Started {day(f.enrolled_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Lists" icon={<ShieldCheck className="w-4 h-4" />}>
        <div className="grid sm:grid-cols-2 gap-2">
          {lists.map((l) => {
            const c = consentByList.get(l.slug)
            return (
              <div key={l.slug} className="flex items-center justify-between rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2">
                <div>
                  <div className="text-sm text-white">{l.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[#666]">
                    {l.audience}
                    {l.requires_age_verification ? ' · 21+' : ''}
                    {!l.is_active ? ' · inactive' : ''}
                  </div>
                </div>
                <span
                  className={cn(
                    'text-xs',
                    c?.status === 'subscribed' ? 'text-[#C792FF]' : c ? 'text-orange-400' : 'text-[#666]'
                  )}
                >
                  {c?.status === 'subscribed'
                    ? `Subscribed ${c.subscribed_at ? new Date(c.subscribed_at).toLocaleDateString() : ''}`
                    : c
                      ? `Unsubscribed ${c.unsubscribed_at ? new Date(c.unsubscribed_at).toLocaleDateString() : ''}`
                      : 'Never asked'}
                </span>
              </div>
            )
          })}
        </div>
        <ConsentActions
          contactId={contact.id}
          lists={lists.filter((l) => l.is_active)}
          subscribedSlugs={consents.filter((c) => c.status === 'subscribed').map((c) => c.list_slug)}
          canManage={permissions.canManage}
          onDone={load}
        />
      </Section>

      <Section title="Consent history" icon={<History className="w-4 h-4" />}>
        {events.length === 0 ? (
          <p className="text-sm text-[#666]">No consent recorded. This person has never opted in or out.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-white font-medium">
                    {ACTION_LABELS[e.action] || e.action}
                    {e.list_slug ? `: ${listNames.get(e.list_slug) || e.list_slug}` : ''}
                  </span>
                  <span className="text-xs text-[#666]">{new Date(e.created_at).toLocaleString()}</span>
                </div>
                <div className="text-xs text-[#A0A0A0] mt-1">
                  via {SOURCE_LABELS[e.source] || e.source}
                  {e.actor_name ? ` · recorded by ${e.actor_name}` : ''}
                  {e.source_detail ? ` · ${e.source_detail}` : ''}
                </div>
                {e.consent_text && (
                  <blockquote className="mt-2 text-xs text-[#D0D0D0] border-l-2 border-[#9B30FF]/60 pl-2">
                    &ldquo;{e.consent_text}&rdquo;
                    {e.consent_text_version && <span className="text-[#666]"> ({e.consent_text_version})</span>}
                  </blockquote>
                )}
                {e.evidence_note && <p className="mt-2 text-xs text-[#A0A0A0]">Evidence: {e.evidence_note}</p>}
                {(e.ip_address || e.country_code || e.user_agent) && (
                  <p className="mt-1 text-[10px] text-[#666] break-all">
                    {[e.ip_address, e.country_code, e.user_agent].filter(Boolean).join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Emails" icon={<Mail className="w-4 h-4" />}>
        {messages.length === 0 ? (
          <p className="text-sm text-[#666]">No emails logged.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} className="border-b border-[#1A1A1A] last:border-0">
                  <td className="py-2 pr-3 text-white">{m.subject}</td>
                  <td className="py-2 pr-3 text-xs text-[#A0A0A0]">{m.stream || '—'}</td>
                  <td className="py-2 pr-3 text-xs text-[#A0A0A0]">{m.status}</td>
                  <td className="py-2 text-xs text-[#666] whitespace-nowrap">{new Date(m.sent_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {permissions.canManage && (
        <DataRequests contactId={contact.id} email={contact.email} onDeleted={() => router.push('/admin/crm/contacts')} />
      )}
    </div>
  )
}

function Composer({
  contactId,
  to,
  from,
  gmailConfigured,
  replyTo,
  onClose,
  onSent,
}: {
  contactId: string
  to: string
  from: string
  gmailConfigured: boolean
  replyTo: { messageId: string; subject: string } | null
  onClose: () => void
  onSent: () => void
}) {
  const [subject, setSubject] = useState(replyTo?.subject || '')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSubject(replyTo?.subject || '')
  }, [replyTo])

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/crm/contacts/${contactId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, replyToMessageId: replyTo?.messageId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Send failed')
        return
      }
      onSent()
    } catch {
      setError('Send failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#A0A0A0]">
        <span>
          From <span className="text-white">{from}</span> to <span className="text-white">{to}</span>
        </span>
        {replyTo && <span className="text-[#C792FF]">Replying in the existing thread</span>}
      </div>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        maxLength={200}
        className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[#2A2A2A] text-white placeholder-[#666] text-sm focus:outline-none focus:border-[#9B30FF]/60"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        placeholder="Write your message. Plain text, like a normal email."
        className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[#2A2A2A] text-white placeholder-[#666] text-sm focus:outline-none focus:border-[#9B30FF]/60"
      />
      <p className="text-xs text-[#666]">
        A short footer is added: our company name and postal address, and &ldquo;Reply &lsquo;unsubscribe&rsquo; and we
        won&apos;t email you again.&rdquo;
        {gmailConfigured
          ? ' Sent from your Gmail, so it appears in your Sent folder and replies come to you.'
          : ' Gmail isn’t connected, so this goes through the Workspace relay from your address. It won’t appear in your Sent folder, but replies still come to you.'}
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={send}
          disabled={busy || !subject.trim() || !body.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs bg-[#9B30FF] text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {busy ? 'Sending…' : 'Send'}
        </button>
        <button onClick={onClose} className="px-4 py-1.5 rounded-full text-xs text-[#A0A0A0] hover:text-white">
          Cancel
        </button>
      </div>
    </div>
  )
}

function AddToSequence({
  contactId,
  sequences,
  enrolledSequenceIds,
  from,
  gmailConfigured,
  onDone,
  onClose,
}: {
  contactId: string
  sequences: { id: string; name: string; steps: number }[]
  enrolledSequenceIds: string[]
  from: string
  gmailConfigured: boolean
  onDone: () => void
  onClose: () => void
}) {
  const available = sequences.filter((s) => !enrolledSequenceIds.includes(s.id))
  const [sequenceId, setSequenceId] = useState(available[0]?.id || '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function enroll() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/crm/outreach/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceId, contactIds: [contactId] }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Could not enroll')
        return
      }
      if (json.enrolled > 0) setMessage('Enrolled. The first step goes out from your mailbox when it’s due.')
      else if (json.suppressed?.length) setError('This address is suppressed.')
      else setMessage('Already in this sequence.')
      if (json.warning) setMessage((m) => `${m || ''} ${json.warning}`.trim())
      onDone()
    } catch {
      setError('Could not enroll')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-4">
      {!gmailConfigured ? (
        <p className="text-sm text-[#A0A0A0]">
          Sequences need Gmail connected (to send from your mailbox and notice replies). See
          docs/email/gmail-and-outreach.md.
        </p>
      ) : available.length === 0 ? (
        <p className="text-sm text-[#A0A0A0]">
          {sequences.length === 0 ? 'No sequences yet. ' : 'Already in every sequence. '}
          <Link href="/admin/crm/outreach" className="text-[#C792FF] hover:underline">
            Manage sequences
          </Link>
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sequenceId}
              onChange={(e) => setSequenceId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#111] border border-[#2A2A2A] text-white text-sm focus:outline-none focus:border-[#9B30FF]/60"
            >
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.steps} step{s.steps === 1 ? '' : 's'})
                </option>
              ))}
            </select>
            <button
              onClick={enroll}
              disabled={busy || !sequenceId}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs bg-[#9B30FF] text-white disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListPlus className="w-3.5 h-3.5" />}
              Enroll
            </button>
          </div>
          <p className="text-xs text-[#666]">
            Steps are sent from {from}. Any reply, bounce, or unsubscribe stops the sequence.
          </p>
        </>
      )}
      {message && <p className="text-xs text-emerald-400">{message}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={onClose} className="px-4 py-1.5 rounded-full text-xs text-[#A0A0A0] hover:text-white">
        Close
      </button>
    </div>
  )
}

interface Thread {
  key: string
  subject: string
  messages: ConversationMessage[]
  latest: ConversationMessage
}

function groupThreads(messages: ConversationMessage[]): Thread[] {
  const byKey = new Map<string, ConversationMessage[]>()
  for (const m of messages) {
    // Gmail thread ids belong to one mailbox.
    const key = m.gmail_thread_id ? `${m.mailbox || ''}:${m.gmail_thread_id}` : `msg:${m.id}`
    byKey.set(key, [...(byKey.get(key) || []), m])
  }
  return [...byKey.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())
      return { key, subject: sorted[0].subject, messages: sorted, latest: sorted[sorted.length - 1] }
    })
    .sort((a, b) => new Date(b.latest.sent_at).getTime() - new Date(a.latest.sent_at).getTime())
}

function Conversation({
  messages,
  onReply,
  canReply,
}: {
  messages: ConversationMessage[]
  onReply: (messageId: string, subject: string) => void
  canReply: boolean
}) {
  if (messages.length === 0) {
    return <p className="text-sm text-[#666]">No emails with this person yet.</p>
  }
  const threads = groupThreads(messages)
  return (
    <ul className="space-y-3">
      {threads.map((t) => (
        <li key={t.key} className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-[#1A1A1A]">
            <span className="text-sm text-white font-medium">{t.subject}</span>
            <span className="flex items-center gap-2 text-xs text-[#666]">
              {t.messages.length > 1 && `${t.messages.length} messages · `}
              {when(t.latest.sent_at)}
              {canReply && (
                <button
                  onClick={() => onReply(t.latest.id, t.subject)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#2A2A2A] text-[#A0A0A0] hover:text-white"
                >
                  <Reply className="w-3 h-3" /> Reply
                </button>
              )}
            </span>
          </div>
          <ul className="divide-y divide-[#1A1A1A]">
            {t.messages.map((m) => (
              <ConversationItem key={m.id} message={m} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

function ConversationItem({ message: m }: { message: ConversationMessage }) {
  const [open, setOpen] = useState(false)
  const inbound = m.direction === 'inbound'
  const body = (m.body_text || '').trim()
  const long = body.length > 400 || body.split('\n').length > 6
  return (
    <li className="px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={cn('flex items-center gap-1', inbound ? 'text-emerald-400' : 'text-[#C792FF]')}>
          {inbound ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
          {inbound ? `From ${m.from_email}` : `${m.sent_by_name || m.from_email} to ${m.to_email}`}
        </span>
        <span className="text-[#666]">
          {[m.stream, m.status !== 'received' && m.status !== 'sent' ? m.status : null].filter(Boolean).join(' · ')}
          {' · '}
          {when(m.sent_at)}
        </span>
      </div>
      {body ? (
        <>
          <pre
            className={cn(
              'mt-1 whitespace-pre-wrap break-words font-sans text-sm text-[#D0D0D0]',
              !open && long && 'max-h-28 overflow-hidden'
            )}
          >
            {body}
          </pre>
          {long && (
            <button onClick={() => setOpen(!open)} className="mt-1 text-xs text-[#C792FF] hover:underline">
              {open ? 'Show less' : 'Show more'}
            </button>
          )}
        </>
      ) : (
        <p className="mt-1 text-xs text-[#666]">No body stored.</p>
      )}
    </li>
  )
}

function OutreachList({ enrollments, onChanged }: { enrollments: OutreachEnrollment[]; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function stop(id: string) {
    if (!confirm('Stop this sequence for this person? No more steps will be sent.')) return
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/crm/outreach/enrollments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Could not stop')
      else onChanged()
    } catch {
      setError('Could not stop')
    } finally {
      setBusyId(null)
    }
  }

  if (enrollments.length === 0) return <p className="text-sm text-[#666]">Not in any outreach sequence.</p>
  return (
    <>
      <ul className="space-y-2">
        {enrollments.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white">{e.sequence_name}</span>
                <StatusChip status={e.status} />
              </div>
              <div className="text-xs text-[#A0A0A0] mt-0.5">
                From {e.sender_name || e.sender_email}
                {' · '}
                {e.status === 'active'
                  ? `step ${Math.min(e.next_step, e.total_steps)} of ${e.total_steps} next ${when(e.next_run_at)}`
                  : `${Math.max(0, e.next_step - 1)} of ${e.total_steps} sent`}
                {e.last_sent_at ? ` · last sent ${when(e.last_sent_at)}` : ''}
                {e.stopped_reason ? ` · ${e.stopped_reason}` : ''}
              </div>
            </div>
            {e.status === 'active' && (
              <button
                onClick={() => stop(e.id)}
                disabled={busyId === e.id}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-xs border border-[#2A2A2A] text-[#A0A0A0] hover:text-red-400 disabled:opacity-40"
              >
                <CircleStop className="w-3.5 h-3.5" /> Stop
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </>
  )
}

function ConsentActions({
  contactId,
  lists,
  subscribedSlugs,
  canManage,
  onDone,
}: {
  contactId: string
  lists: ListInfo[]
  subscribedSlugs: string[]
  canManage: boolean
  onDone: () => void
}) {
  const [mode, setMode] = useState<'none' | 'opt_in' | 'opt_out'>('none')
  const [selected, setSelected] = useState<string[]>([])
  const [evidence, setEvidence] = useState('')
  const [ageVerified, setAgeVerified] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(action: 'opt_in' | 'opt_out' | 'unsubscribe_all') {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/crm/contacts/${contactId}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, lists: selected, evidenceNote: evidence, ageVerified }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Update failed')
        return
      }
      setMode('none')
      setSelected([])
      setEvidence('')
      setAgeVerified(false)
      onDone()
    } catch {
      setError('Update failed')
    } finally {
      setBusy(false)
    }
  }

  const choices =
    mode === 'opt_out' ? lists.filter((l) => subscribedSlugs.includes(l.slug)) : lists
  const needsAge = mode === 'opt_in' && lists.some((l) => selected.includes(l.slug) && l.requires_age_verification)

  return (
    <div className="mt-4 border-t border-[#2A2A2A] pt-4">
      {mode === 'none' ? (
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <button onClick={() => setMode('opt_in')} className="px-3 py-1.5 rounded-full text-xs border border-[#9B30FF]/50 text-[#C792FF] hover:bg-[#9B30FF]/10">
              Record an opt-in
            </button>
          )}
          {subscribedSlugs.length > 0 && (
            <button onClick={() => setMode('opt_out')} className="px-3 py-1.5 rounded-full text-xs border border-[#2A2A2A] text-[#A0A0A0] hover:text-white">
              Opt out of a list
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('Unsubscribe this person from all Untamed marketing email?')) submit('unsubscribe_all')
            }}
            disabled={busy}
            className="px-3 py-1.5 rounded-full text-xs border border-[#2A2A2A] text-[#A0A0A0] hover:text-red-400"
          >
            Unsubscribe from all
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-white">{mode === 'opt_in' ? 'Record an opt-in' : 'Opt out of'}</div>
          <div className="flex flex-wrap gap-2">
            {choices.map((l) => (
              <label key={l.slug} className="flex items-center gap-2 text-sm text-[#D0D0D0] px-3 py-1.5 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A]">
                <input
                  type="checkbox"
                  className="accent-[#9B30FF]"
                  checked={selected.includes(l.slug)}
                  onChange={(e) =>
                    setSelected((prev) => (e.target.checked ? [...prev, l.slug] : prev.filter((s) => s !== l.slug)))
                  }
                />
                {l.name}
              </label>
            ))}
          </div>
          {mode === 'opt_in' && (
            <>
              <textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                rows={3}
                placeholder="Evidence: where, when, and how they agreed (e.g. signed the email sign-up sheet at the Tampa tasting, 2026-10-02; sheet scanned to Drive)."
                className="w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder-[#666] text-sm focus:outline-none focus:border-[#9B30FF]/60"
              />
              {needsAge && (
                <label className="flex items-start gap-2 text-sm text-[#D0D0D0]">
                  <input type="checkbox" className="mt-1 accent-[#9B30FF]" checked={ageVerified} onChange={(e) => setAgeVerified(e.target.checked)} />
                  <span>
                    The evidence shows they are 21 or older. Without this, they won&apos;t receive 21+ lists.
                  </span>
                </label>
              )}
              <p className="text-xs text-[#666]">
                Only record an opt-in the person actually gave. This entry is permanent and shows your name.
              </p>
            </>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => submit(mode)}
              disabled={busy || selected.length === 0 || (mode === 'opt_in' && evidence.trim().length < 10)}
              className="px-4 py-1.5 rounded-full text-xs bg-[#9B30FF] text-white disabled:opacity-40"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => {
                setMode('none')
                setSelected([])
                setError(null)
              }}
              className="px-4 py-1.5 rounded-full text-xs text-[#A0A0A0] hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {mode === 'none' && error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  )
}

function DataRequests({ contactId, email, onDeleted }: { contactId: string; email: string; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/crm/contacts/${contactId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail, note }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Delete failed')
      else onDeleted()
    } catch {
      setError('Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="Data requests" icon={<AlertTriangle className="w-4 h-4" />}>
      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/admin/crm/contacts/${contactId}/export`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-[#2A2A2A] text-[#A0A0A0] hover:text-white"
        >
          <Download className="w-3.5 h-3.5" /> Export email data (JSON)
        </a>
        {!deleting && (
          <button
            onClick={() => setDeleting(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete email data
          </button>
        )}
      </div>
      {deleting && (
        <div className="mt-4 space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm text-red-300">
            Permanently deletes this contact, their consent history, email log, and queued emails, and
            suppresses the address so it is never emailed again. Loyalty, order, and lead records are not
            changed. This can&apos;t be undone.
          </p>
          <input
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={`Type ${email} to confirm`}
            className="w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder-[#666] text-sm"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Request reference (optional, no personal details)"
            className="w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder-[#666] text-sm"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={remove}
              disabled={busy || confirmEmail.trim().toLowerCase() !== email}
              className="px-4 py-1.5 rounded-full text-xs bg-red-600 text-white disabled:opacity-40"
            >
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
            <button onClick={() => setDeleting(false)} className="px-4 py-1.5 rounded-full text-xs text-[#A0A0A0]">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Section>
  )
}

function BackLink() {
  return (
    <Link href="/admin/crm/contacts" className="inline-flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-white mb-2">
      <ArrowLeft className="w-4 h-4" /> Contacts
    </Link>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-[#666]">{label}</dt>
      <dd className="text-white mt-0.5">{value}</dd>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
      <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </section>
  )
}
