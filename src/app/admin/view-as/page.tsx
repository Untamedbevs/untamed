'use client'

import { useEffect, useState } from 'react'
import { Copy, Eye, FlaskConical, Loader2, Lock, RotateCcw, Search, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MemberResult {
  id: string
  email: string
  firstName: string | null
  pointsBalance: number
  hasLogin: boolean
  enrolled: boolean
  referralCode: string | null
  createdAt: string
}

type Mode = 'current' | 'pack-rewards'

export default function AdminViewAsPage() {
  const [query, setQuery] = useState('')
  const [members, setMembers] = useState<MemberResult[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      fetch(`/api/admin/view-as?q=${encodeURIComponent(query.trim())}`)
        .then(async (res) => {
          if (res.status === 401) {
            setForbidden(true)
            return
          }
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Search failed')
          setMembers(data.members || [])
          setError('')
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  async function start(member: { id: string }, mode: Mode) {
    setStarting(`${member.id}:${mode}`)
    setError('')
    try {
      const res = await fetch('/api/admin/view-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start View As')
      window.location.href = data.redirectTo
    } catch (err) {
      setError((err as Error).message)
      setStarting(null)
    }
  }

  if (forbidden) {
    return (
      <div className="max-w-xl rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 text-sm text-[#A0A0A0]">
        <Lock className="mb-3 h-5 w-5 text-[#9B30FF]" />
        View As is for admins only.
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-white mb-1">View As</h1>
        <p className="max-w-3xl text-sm text-[#A0A0A0]">
          See the member portal exactly as a member sees it, to troubleshoot, walk them through it, or demo it.
          It&apos;s read-only: nothing you click changes their account. A session ends after 2 hours or when you
          press <span className="text-white">Exit View As</span> in the portal.
        </p>
      </div>

      <TestCustomerCard
        onPreview={(id) => start({ id }, 'pack-rewards')}
        previewing={starting?.endsWith(':pack-rewards') ?? false}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email, first name, or referral code"
          className="w-full rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] py-3 pl-11 pr-4 text-white placeholder-[#666] transition-colors focus:border-[#9B30FF] focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#2A2A2A] bg-[#141414]">
        <div className="flex items-center justify-between border-b border-[#2A2A2A] px-5 py-3 text-xs uppercase tracking-wider text-[#666]">
          <span>{query.trim() ? 'Matches' : 'Newest members'}</span>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        {!loading && members.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[#A0A0A0]">No members match that search.</p>
        ) : (
          <ul className="divide-y divide-[#2A2A2A]">
            {members.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-white">{m.firstName || m.email}</div>
                  <div className="truncate text-xs text-[#A0A0A0]">{m.email}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                    <Badge>{m.pointsBalance.toLocaleString()} pts</Badge>
                    {m.referralCode && <Badge>Code {m.referralCode}</Badge>}
                    {m.enrolled && <Badge tone="purple">Pack Rewards enrolled</Badge>}
                    {!m.hasLogin && <Badge tone="amber">No portal login yet</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => start(m, 'current')}
                    disabled={!!starting}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#9B30FF] hover:text-white disabled:opacity-50"
                  >
                    {starting === `${m.id}:current` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    View as
                  </button>
                  <button
                    type="button"
                    onClick={() => start(m, 'pack-rewards')}
                    disabled={!!starting}
                    title="Their data in the Pack Rewards portal that staff are previewing"
                    className="inline-flex items-center gap-2 rounded-full border border-[#9B30FF]/60 px-4 py-2 text-sm font-semibold text-[#C89BFF] transition-colors hover:bg-[#9B30FF]/10 disabled:opacity-50"
                  >
                    {starting === `${m.id}:pack-rewards` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Pack Rewards preview
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: 'purple' | 'amber' }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5',
        tone === 'purple'
          ? 'border-[#9B30FF]/40 bg-[#9B30FF]/10 text-[#C89BFF]'
          : tone === 'amber'
            ? 'border-[#FFD700]/30 bg-[#FFD700]/10 text-[#FFD700]/90'
            : 'border-[#2A2A2A] text-[#A0A0A0]'
      )}
    >
      {children}
    </span>
  )
}

interface TestCustomer {
  id: string
  email: string
  pointsBalance: number
  enrolled: boolean
  spiritAnimal: string | null
}

/**
 * The shared test customer: sign in as it in a private window to go through
 * onboarding for real, then reset it to a fresh signup to start over.
 */
function TestCustomerCard({ onPreview, previewing }: { onPreview: (id: string) => void; previewing: boolean }) {
  const [customer, setCustomer] = useState<TestCustomer | null>(null)
  const [busy, setBusy] = useState<'reset' | 'link' | null>(null)
  const [link, setLink] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/admin/test-customer')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Could not load the test customer')
    setCustomer(data)
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message))
  }, [])

  async function act(action: 'reset' | 'sign-in-link') {
    setBusy(action === 'reset' ? 'reset' : 'link')
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/test-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      if (action === 'reset') {
        setLink('')
        await load()
        setNotice('Reset to a brand-new signup. Reload the test customer portal, or open a new sign-in link, to run onboarding again.')
      } else {
        setLink(data.url)
        const copied = await navigator.clipboard.writeText(data.url).then(() => true, () => false)
        setNotice(
          `${copied ? 'Link copied. ' : ''}Open it in a private or incognito window so you stay signed in here. It works once and expires in an hour.`
        )
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  function reset() {
    if (window.confirm('Reset the test customer? This clears its enrollment, points, Hunts, and claims.')) {
      act('reset')
    }
  }

  return (
    <div className="rounded-2xl border border-[#9B30FF]/40 bg-[#9B30FF]/5 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-medium text-white">
            <FlaskConical className="h-4 w-4 text-[#C89BFF]" />
            Test customer
          </div>
          <div className="truncate text-xs text-[#A0A0A0]">{customer?.email ?? 'Loading…'}</div>
          {customer && (
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
              <Badge>{customer.pointsBalance.toLocaleString()} pts</Badge>
              {customer.enrolled ? (
                <Badge tone="purple">Onboarded{customer.spiritAnimal ? ` · ${customer.spiritAnimal}` : ''}</Badge>
              ) : (
                <Badge tone="amber">Ready for onboarding</Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => act('sign-in-link')}
            disabled={!customer || !!busy}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#9B30FF] hover:text-white disabled:opacity-50"
          >
            {busy === 'link' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Copy sign-in link
          </button>
          <button
            type="button"
            onClick={() => customer && onPreview(customer.id)}
            disabled={!customer || !!busy || previewing}
            className="inline-flex items-center gap-2 rounded-full border border-[#9B30FF]/60 px-4 py-2 text-sm font-semibold text-[#C89BFF] transition-colors hover:bg-[#9B30FF]/10 disabled:opacity-50"
          >
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Pack Rewards preview
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!customer || !!busy}
            className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-4 py-2 text-sm font-semibold text-[#A0A0A0] transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
          >
            {busy === 'reset' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Reset
          </button>
        </div>
      </div>
      {notice && <p className="mt-3 text-sm text-[#C89BFF]">{notice}</p>}
      {link && (
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 font-mono text-xs text-[#A0A0A0]"
        />
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  )
}
