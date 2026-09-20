'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, ExternalLink, Loader2, Megaphone, RefreshCw } from 'lucide-react'

interface StructureSpec {
  key: string
  name: string
  utmCampaign: string
  landingPath: string
  dailyBudget: number
  audience: string
  headline: string
  primaryText: string
  landingUrl: string
}

interface CampaignRow {
  id: string
  name: string
  objective: string
  status: string
  effective_status: string
  daily_budget?: string
  insights: {
    spend?: string
    impressions?: string
    clicks?: string
    ctr?: string
    cpc?: string
  } | null
  leads: number
}

interface AdsPayload {
  config: {
    configured: boolean
    tokenSet: boolean
    tokenHint: string | null
    adAccountId: string | null
    pixelId: string | null
    pageId: string | null
    pageTokenSet: boolean
    igUserId: string | null
    capiTokenSet: boolean
    graphVersion: string
  }
  connection: {
    configured: boolean
    ok: boolean
    account?: { id: string; name: string; status: string; currency: string; business?: string }
    pixel?: { id: string; name?: string; matched: boolean }
    token?: { is_valid: boolean; scopes: string[]; expires_at: number | null; type?: string }
    missingScopes: string[]
    error?: string
  }
  campaigns: CampaignRow[]
  structure: StructureSpec[]
  structureDailyBudget: number
  existingStructureCount: number
  adsManagerUrl: string | null
  error?: string
}

const SETUP_STEPS = [
  {
    title: 'Create or open Business Manager',
    body: 'Go to business.facebook.com. Confirm the Untamed business owns the Facebook Page, an ad account, and a Pixel.',
    href: 'https://business.facebook.com',
    label: 'Business Manager',
  },
  {
    title: 'Accept alcohol advertising terms',
    body: 'Untamed is 15% ABV. In Ads Manager, complete alcohol advertising authorization and keep every audience 21+.',
    href: 'https://www.facebook.com/business/help/223112211036387',
    label: 'Alcohol ads policy',
  },
  {
    title: 'Create a Meta app',
    body: 'developers.facebook.com → Create app → type Business → name it Untamed Ads. Add the Marketing API product. Add the app under Business Settings → Accounts → Apps.',
    href: 'https://developers.facebook.com/apps',
    label: 'Developer apps',
  },
  {
    title: 'Create a system user and token',
    body: 'Business Settings → Users → System users → Add Untamed Server (Admin). Assign the ad account (Manage ads) and Pixel. Generate a token for the Untamed Ads app with ads_management, ads_read, and business_management.',
    href: 'https://business.facebook.com/latest/settings/system_users',
    label: 'System users',
  },
  {
    title: 'Paste IDs into env',
    body: 'Local: .env.local. Production: Vercel env. Restart the dev server after saving. Then reload this page.',
    href: null,
    label: null,
  },
]

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function budgetFromCents(value?: string) {
  if (!value) return '—'
  return money(Number(value) / 100)
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-green-400' : 'bg-[#666]'}`} />
}

export default function MetaAdsPage() {
  const [data, setData] = useState<AdsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function load() {
    setLoading(true)
    fetch('/api/admin/ads/meta')
      .then((res) => res.json())
      .then((payload) => setData(payload))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const envBlock = `META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=
NEXT_PUBLIC_META_PIXEL_ID=
META_CAPI_ACCESS_TOKEN=
META_FB_PAGE_ID=`

  async function copyEnv() {
    await navigator.clipboard.writeText(envBlock)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function syncSpend() {
    setWorking('sync')
    setMessage(null)
    try {
      const res = await fetch('/api/admin/ads/meta/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Sync failed')
      setMessage(
        `Synced ${json.upserted} rows (${money(json.spend)} spend, ${json.clicks} clicks, ${json.leads} leads).`
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sync failed')
    } finally {
      setWorking(null)
    }
  }

  async function bootstrap() {
    if (
      !confirm(
        'Create the three Florida retail campaigns as PAUSED drafts? Nothing will spend until you turn them on.'
      )
    ) {
      return
    }
    setWorking('bootstrap')
    setMessage(null)
    try {
      const res = await fetch('/api/admin/ads/meta/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Create failed')
      const created = json.created?.length || 0
      const skipped = json.skipped?.length || 0
      const errors = json.errors?.length || 0
      setMessage(`Created ${created} paused campaigns. Skipped ${skipped}. Errors ${errors}.`)
      load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Create failed')
    } finally {
      setWorking(null)
    }
  }

  async function setStatus(id: string, status: 'ACTIVE' | 'PAUSED') {
    if (status === 'ACTIVE' && !confirm('This will start spending. Turn this campaign on?')) return
    setWorking(id)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/ads/meta/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Update failed')
      load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Update failed')
    } finally {
      setWorking(null)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#999]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking Meta Ads connection…
      </div>
    )
  }

  const config = data?.config
  const connection = data?.connection
  const connected = Boolean(connection?.ok)

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Megaphone className="h-5 w-5 text-[#FFD700]" />
          <div>
            <h1 className="text-2xl font-bold text-white">Meta Ads</h1>
            <p className="text-sm text-[#999]">
              Marketing API {config?.graphVersion || 'v26.0'} · Florida retail leads into the campaign LPs
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-3 py-2 text-sm text-white hover:bg-[#1A1A1A]"
          >
            <RefreshCw className="h-4 w-4" />
            Recheck
          </button>
          {data?.adsManagerUrl && (
            <a
              href={data.adsManagerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-3 py-2 text-sm text-white hover:bg-[#1A1A1A]"
            >
              Ads Manager
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {message && (
        <p className="rounded-xl border border-[#2A2A2A] bg-[#141414] px-4 py-3 text-sm text-white">{message}</p>
      )}
      {data?.error && <p className="text-sm text-red-400">{data.error}</p>}
      {connection?.error && <p className="text-sm text-red-400">{connection.error}</p>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CheckCard label="Access token" ok={Boolean(config?.tokenSet)} detail={config?.tokenHint || 'Not set'} />
        <CheckCard
          label="Ad account"
          ok={Boolean(config?.adAccountId)}
          detail={connection?.account?.name || config?.adAccountId || 'Not set'}
        />
        <CheckCard
          label="Pixel"
          ok={Boolean(config?.pixelId)}
          detail={connection?.pixel?.name || config?.pixelId || 'Not set'}
        />
        <CheckCard
          label="API connection"
          ok={connected}
          detail={
            connected
              ? `${connection?.account?.status} · ${connection?.account?.currency}`
              : 'Waiting on credentials'
          }
        />
      </section>

      {!connected && (
        <section className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">Connect the Marketing API</h2>
          <ol className="space-y-4">
            {SETUP_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFD700]/15 text-xs font-semibold text-[#FFD700]">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{step.title}</p>
                  <p className="mt-1 text-sm text-[#999]">{step.body}</p>
                  {step.href && (
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-[#FFD700] hover:underline"
                    >
                      {step.label}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-[#666]">Add to .env.local and Vercel</p>
              <button
                type="button"
                onClick={copyEnv}
                className="inline-flex items-center gap-1 text-xs text-[#999] hover:text-white"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="overflow-x-auto text-xs text-[#A0A0A0]">{envBlock}</pre>
            <p className="mt-3 text-xs text-[#666]">
              Ad account ID is the number after <code>act=</code> in Ads Manager. Pixel ID is in Events Manager.
              The same system-user token can serve CAPI if it can write to the Pixel.
            </p>
          </div>
        </section>
      )}

      {connected && (connection?.missingScopes?.length ?? 0) > 0 && (
        <p className="text-sm text-[#FFD700]">
          Token is missing: {connection?.missingScopes.join(', ')}. Generate a new system-user token with those
          permissions.
        </p>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Florida retail structure</h2>
          <p className="text-sm text-[#999]">{money(data?.structureDailyBudget || 0)} / day if all three run</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {(data?.structure || []).map((spec) => (
            <div key={spec.key} className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-4">
              <p className="text-xs uppercase tracking-wider text-[#FFD700]">{spec.key}</p>
              <h3 className="mt-1 font-semibold text-white">{spec.name}</h3>
              <p className="mt-2 text-sm text-[#999]">{spec.audience}</p>
              <p className="mt-3 text-sm text-white">{money(spec.dailyBudget)} / day</p>
              <p className="mt-2 text-xs text-[#666]">
                {spec.headline}
                <br />
                {spec.landingPath}?utm_campaign={spec.utmCampaign}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={bootstrap}
            disabled={!connected || working === 'bootstrap'}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FFD700] px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            {working === 'bootstrap' && <Loader2 className="h-4 w-4 animate-spin" />}
            Create paused drafts
          </button>
          <button
            type="button"
            onClick={syncSpend}
            disabled={!connected || working === 'sync'}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm text-white hover:bg-[#1A1A1A] disabled:opacity-40"
          >
            {working === 'sync' && <Loader2 className="h-4 w-4 animate-spin" />}
            Sync spend to performance
          </button>
          <Link href="/admin/retail/performance" className="inline-flex items-center px-3 py-2 text-sm text-[#999] hover:text-white">
            Performance
          </Link>
          <Link href="/admin/retail/utm-builder" className="inline-flex items-center px-3 py-2 text-sm text-[#999] hover:text-white">
            UTM Builder
          </Link>
        </div>
        <p className="mt-2 text-xs text-[#666]">
          Drafts include campaign + ad set only (age 21+, Florida, optimize for website Lead). Ads need creative
          next — they will not spend while paused.
          {data?.existingStructureCount
            ? ` ${data.existingStructureCount} of 3 structure campaigns already exist.`
            : ''}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Campaigns in the ad account</h2>
        {!connected ? (
          <p className="text-sm text-[#666]">Connect the API to list live campaigns.</p>
        ) : data?.campaigns?.length === 0 ? (
          <p className="text-sm text-[#666]">No campaigns in this account yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#2A2A2A]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#141414] text-xs uppercase tracking-wider text-[#666]">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Budget</th>
                  <th className="px-4 py-3">Spend</th>
                  <th className="px-4 py-3">Clicks</th>
                  <th className="px-4 py-3">Leads</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data?.campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-t border-[#2A2A2A]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{campaign.name}</p>
                      <p className="text-xs text-[#666]">{campaign.objective}</p>
                    </td>
                    <td className="px-4 py-3 text-[#A0A0A0]">{campaign.effective_status}</td>
                    <td className="px-4 py-3 text-[#A0A0A0]">{budgetFromCents(campaign.daily_budget)}</td>
                    <td className="px-4 py-3 text-[#A0A0A0]">
                      {campaign.insights?.spend ? money(Number(campaign.insights.spend)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#A0A0A0]">{campaign.insights?.clicks || '—'}</td>
                    <td className="px-4 py-3 text-[#A0A0A0]">{campaign.leads || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {campaign.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          onClick={() => setStatus(campaign.id, 'PAUSED')}
                          disabled={working === campaign.id}
                          className="text-xs text-[#999] hover:text-white"
                        >
                          Pause
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStatus(campaign.id, 'ACTIVE')}
                          disabled={working === campaign.id}
                          className="text-xs text-[#FFD700] hover:underline"
                        >
                          Turn on
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function CheckCard({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#666]">
        <StatusDot ok={ok} />
        {label}
      </div>
      <p className="mt-2 truncate text-sm text-white">{detail}</p>
    </div>
  )
}
