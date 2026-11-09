'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, Loader2, AlertTriangle, ShieldCheck, Ban, Users, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContactRow {
  id: string | null
  email: string
  first_name: string | null
  last_name: string | null
  sources: string[]
  age_verified_at: string | null
  country_code: string | null
  repermission_sent_at: string | null
  created_at: string
  email_consents: { list_slug: string; status: string }[]
  suppression: string | null
}

interface Summary {
  contacts: number
  suppressed: number
  lists: { slug: string; name: string; subscribed: number; is_active: boolean }[]
}

const SOURCE_LABELS: Record<string, string> = {
  loyalty: 'Loyalty',
  order: 'Customer',
  referral: 'Referrer',
  distributor: 'Wholesale',
  influencer: 'Creator',
  contact_form: 'Contact form',
  consent: 'Email link',
  admin: 'Staff added',
}

export default function ContactsPage() {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [list, setList] = useState('')
  const [status, setStatus] = useState<'subscribed' | 'unsubscribed'>('subscribed')
  const [suppressedOnly, setSuppressedOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<ContactRow[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q)
      setPage(0)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (list) {
      params.set('list', list)
      params.set('status', status)
    }
    if (suppressedOnly) params.set('suppressed', '1')
    params.set('page', String(page))

    fetch(`/api/admin/crm/contacts?${params}`)
      .then(async (res) => {
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || 'Could not load contacts')
          setRows([])
          return
        }
        setRows(data.contacts || [])
        setTotal(data.total || 0)
        setPageSize(data.pageSize || 50)
        if (data.summary) setSummary(data.summary)
      })
      .catch(() => !cancelled && setError('Could not load contacts'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [query, list, status, suppressedOnly, page])

  const listNames = new Map((summary?.lists || []).map((l) => [l.slug, l.name]))
  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/crm" className="text-[#A0A0A0] hover:text-white" aria-label="Back to CRM">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Contacts</h1>
      </div>
      <p className="text-sm text-[#A0A0A0] mb-6">
        Every email address from loyalty, orders, referrals, wholesale, creators, and the contact form,
        with what each person has agreed to receive.
      </p>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Stat label="Contacts" value={summary.contacts} icon={<Users className="w-4 h-4" />} />
          {summary.lists.filter((l) => l.is_active).map((l) => (
            <Stat key={l.slug} label={l.name} value={l.subscribed} icon={<ShieldCheck className="w-4 h-4" />} />
          ))}
          <Stat label="Suppressed" value={summary.suppressed} icon={<Ban className="w-4 h-4" />} tone="warn" />
        </div>
      )}

      <CheckoutConsentCard />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[#666] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email or name"
            disabled={suppressedOnly}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white placeholder-[#666] text-sm focus:outline-none focus:border-[#9B30FF]/60 disabled:opacity-50"
          />
        </div>
        <select
          value={list}
          onChange={(e) => {
            setList(e.target.value)
            setPage(0)
          }}
          disabled={suppressedOnly}
          className="px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm disabled:opacity-50"
        >
          <option value="">All lists</option>
          {(summary?.lists || []).map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.name}
            </option>
          ))}
        </select>
        {list && !suppressedOnly && (
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as 'subscribed' | 'unsubscribed')
              setPage(0)
            }}
            className="px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm"
          >
            <option value="subscribed">Subscribed</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-[#A0A0A0] px-2">
          <input
            type="checkbox"
            checked={suppressedOnly}
            onChange={(e) => {
              setSuppressedOnly(e.target.checked)
              setPage(0)
            }}
            className="accent-[#9B30FF]"
          />
          Suppressed only
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400 flex items-start gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-xl border border-[#2A2A2A] bg-[#111] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-[#666] border-b border-[#2A2A2A]">
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Found in</th>
              <th className="px-4 py-3 font-medium">Subscribed to</th>
              <th className="px-4 py-3 font-medium">21+</th>
              <th className="px-4 py-3 font-medium">Added</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[#A0A0A0]">
                  <Loader2 className="w-5 h-5 animate-spin inline" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[#A0A0A0]">
                  No contacts match.
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                const subscribed = c.email_consents.filter((e) => e.status === 'subscribed')
                const name = [c.first_name, c.last_name].filter(Boolean).join(' ')
                const content = (
                  <>
                    <div className="text-white">{c.email}</div>
                    {name && <div className="text-xs text-[#666]">{name}</div>}
                  </>
                )
                return (
                  <tr key={c.id || c.email} className="border-b border-[#1A1A1A] last:border-0 hover:bg-[#151515]">
                    <td className="px-4 py-3">
                      {c.id ? (
                        <Link href={`/admin/crm/contacts/${c.id}`} className="block hover:text-[#9B30FF]">
                          {content}
                        </Link>
                      ) : (
                        <div>
                          {content}
                          <div className="text-[10px] text-[#666]">No contact record (deleted or never added)</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.sources.map((s) => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1A1A1A] text-[#A0A0A0]">
                            {SOURCE_LABELS[s] || s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.suppression ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">
                          Suppressed: {c.suppression.replace('_', ' ')}
                        </span>
                      ) : subscribed.length === 0 ? (
                        <span className="text-xs text-[#666]">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {subscribed.map((e) => (
                            <span key={e.list_slug} className="text-[10px] px-1.5 py-0.5 rounded bg-[#9B30FF]/15 text-[#C792FF]">
                              {listNames.get(e.list_slug) || e.list_slug}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.age_verified_at ? <span className="text-[#9B30FF]">Yes</span> : <span className="text-[#666]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#A0A0A0] whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-xs text-[#A0A0A0]">
        <span>{total.toLocaleString()} total</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-full border border-[#2A2A2A] disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
            className="px-3 py-1.5 rounded-full border border-[#2A2A2A] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

interface CheckoutStatus {
  approved: boolean
  wordingKnown: boolean
  version: string
  tickedBuyers: number
  toRecord: number
  canApply: boolean
}

function CheckoutConsentCard() {
  const [status, setStatus] = useState<CheckoutStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = () =>
    fetch('/api/admin/crm/contacts/checkout-consent')
      .then(async (res) => (res.ok ? setStatus(await res.json()) : setStatus(null)))
      .catch(() => setStatus(null))

  useEffect(() => {
    load()
  }, [])

  if (!status || status.tickedBuyers === 0) return null

  async function record() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/crm/contacts/checkout-consent', { method: 'POST' })
      const json = await res.json()
      setMessage(res.ok ? `Recorded ${json.recorded} checkout opt-ins.` : json.error || 'Failed')
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4 mb-6 text-sm flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2 text-[#A0A0A0]">
        <ShoppingCart className="w-4 h-4 mt-0.5 text-[#9B30FF]" />
        <div>
          <div className="text-white">
            {status.tickedBuyers.toLocaleString()} buyers ticked the marketing box at AccelPay checkout
          </div>
          <div className="text-xs mt-0.5">
            {status.approved
              ? `${status.toRecord.toLocaleString()} not yet recorded as opt-ins (anyone who later unsubscribed or bounced is skipped).`
              : status.wordingKnown
                ? `Not recorded until checkout wording ${status.version} is approved (EMAIL_CHECKOUT_CONSENT_APPROVED_VERSION).`
                : 'Not recorded as opt-ins yet: the exact checkbox wording must be confirmed with AccelPay and approved first.'}
          </div>
          {message && <div className="text-xs text-[#C792FF] mt-1">{message}</div>}
        </div>
      </div>
      {status.approved && status.canApply && status.toRecord > 0 && (
        <button
          onClick={record}
          disabled={busy}
          className="px-3 py-1.5 rounded-full text-xs bg-[#9B30FF] text-white disabled:opacity-40"
        >
          {busy ? 'Recording…' : `Record ${status.toRecord.toLocaleString()} opt-ins`}
        </button>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone?: 'warn'
}) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
      <div className={cn('flex items-center gap-1.5 text-xs mb-1', tone === 'warn' ? 'text-orange-400' : 'text-[#A0A0A0]')}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
    </div>
  )
}
