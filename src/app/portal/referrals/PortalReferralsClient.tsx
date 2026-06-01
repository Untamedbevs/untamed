'use client'

import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle,
  Copy,
  Edit3,
  Link as LinkIcon,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  MousePointerClick,
  Send,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import type {
  ReferralInvite,
  ReferralParticipant,
  ReferralRewardEarned,
  ReferralRewardTier,
} from '@/lib/referral/types'
import { CUSTOM_MESSAGE_MAX_LENGTH } from '@/lib/referral/constants'

interface Props {
  initialParticipant: ReferralParticipant
  initialTiers: ReferralRewardTier[]
  initialRewards: ReferralRewardEarned[]
  initialInvites: ReferralInvite[]
  initialConsumerLink: string
  initialDistributorLink: string
}

export function PortalReferralsClient({
  initialParticipant,
  initialTiers,
  initialRewards,
  initialInvites,
  initialConsumerLink,
  initialDistributorLink,
}: Props) {
  const [participant, setParticipant] =
    useState<ReferralParticipant>(initialParticipant)
  const [tiers] = useState<ReferralRewardTier[]>(initialTiers)
  const [rewards] = useState<ReferralRewardEarned[]>(initialRewards)
  const [invites, setInvites] = useState<ReferralInvite[]>(initialInvites)
  const [consumerLink, setConsumerLink] = useState(initialConsumerLink)
  const [distributorLink, setDistributorLink] = useState(initialDistributorLink)

  const stats = useMemo(
    () => [
      {
        label: 'Total clicks',
        value: participant.total_clicks,
        icon: MousePointerClick,
      },
      {
        label: 'Consumer signups',
        value: participant.consumer_signups,
        icon: Users,
      },
      {
        label: 'Distributor leads',
        value: participant.distributor_leads,
        icon: Building2,
      },
      {
        label: 'Paid conversions',
        value: participant.paid_conversions,
        icon: TrendingUp,
      },
    ],
    [participant]
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-2xl text-white mb-1">Referrals</h1>
        <p className="text-sm text-[#A0A0A0]">
          Share Untamed with friends and businesses. Earn rewards for every
          signup and retailer lead you bring in.
        </p>
      </div>

      <ShareLinkSection
        consumerLink={consumerLink}
        distributorLink={distributorLink}
        consumerSignups={participant.consumer_signups}
        distributorLeads={participant.distributor_leads}
        totalClicks={participant.total_clicks}
      />

      <StatsGrid stats={stats} />

      <CodeSection
        participant={participant}
        onUpdated={(updated, links) => {
          setParticipant(updated)
          if (links) {
            setConsumerLink(links.consumerLink)
            setDistributorLink(links.distributorLink)
          }
        }}
      />

      <MessageSection
        participant={participant}
        consumerLink={consumerLink}
        onSaved={(message) =>
          setParticipant((p) => ({ ...p, custom_message: message }))
        }
      />

      <WarmIntroSection
        invites={invites}
        onSent={(invite) => setInvites((prev) => [invite, ...prev])}
      />

      <TierSection
        tiers={tiers}
        rewards={rewards}
        consumerSignups={participant.consumer_signups}
        distributorLeads={participant.distributor_leads}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Share links (consumer + retailer)
// ---------------------------------------------------------------------------

function ShareLinkSection({
  consumerLink,
  distributorLink,
  consumerSignups,
  distributorLeads,
  totalClicks,
}: {
  consumerLink: string
  distributorLink: string
  consumerSignups: number
  distributorLeads: number
  totalClicks: number
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <ShareLinkCard
        type="consumer"
        link={consumerLink}
        clicks={totalClicks}
        conversions={consumerSignups}
      />
      <ShareLinkCard
        type="distributor"
        link={distributorLink}
        clicks={totalClicks}
        conversions={distributorLeads}
      />
    </div>
  )
}

function ShareLinkCard({
  type,
  link,
  clicks,
  conversions,
}: {
  type: 'consumer' | 'distributor'
  link: string
  clicks: number
  conversions: number
}) {
  const [copied, setCopied] = useState(false)
  const isConsumer = type === 'consumer'
  const Icon = isConsumer ? Users : Building2
  const label = isConsumer ? 'Consumer link' : 'Retailer link'
  const description = isConsumer
    ? 'Share with friends who want to try Untamed.'
    : 'Share with bars, restaurants, or stores.'
  const conversionLabel = isConsumer ? 'Signups' : 'Leads'

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
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#9B30FF]" />
        </div>
        <div>
          <h3 className="font-semibold text-white text-sm">{label}</h3>
          <p className="text-xs text-[#A0A0A0]">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-[#0A0A0A] rounded-xl px-3 py-2.5 border border-[#2A2A2A] overflow-hidden">
          <LinkIcon className="w-4 h-4 text-[#666] shrink-0" />
          <span className="text-xs text-[#A0A0A0] truncate font-mono">
            {link}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 w-10 h-10 rounded-xl bg-[#9B30FF] hover:bg-[#7E22CE] transition-colors flex items-center justify-center"
          title="Copy link"
        >
          {copied ? (
            <Check className="w-4 h-4 text-white" />
          ) : (
            <Copy className="w-4 h-4 text-white" />
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Clicks" value={clicks} />
        <Stat label={conversionLabel} value={conversions} accent />
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2">
      <p className="text-[10px] text-[#666] uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`text-lg font-semibold ${
          accent ? 'text-[#9B30FF]' : 'text-white'
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stats grid
// ---------------------------------------------------------------------------

function StatsGrid({
  stats,
}: {
  stats: {
    label: string
    value: number
    icon: React.ComponentType<{ className?: string }>
  }[]
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4"
        >
          <s.icon className="w-4 h-4 text-[#9B30FF] mb-2" />
          <p className="text-xl font-semibold text-white">
            {s.value.toLocaleString()}
          </p>
          <p className="text-xs text-[#A0A0A0] mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Code customization
// ---------------------------------------------------------------------------

function CodeSection({
  participant,
  onUpdated,
}: {
  participant: ReferralParticipant
  onUpdated: (
    p: ReferralParticipant,
    links?: { consumerLink: string; distributorLink: string }
  ) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(participant.referral_code)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/portal/referrals/code', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCode: draft }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update code')
      }
      onUpdated(data.participant, {
        consumerLink: data.consumerLink,
        distributorLink: data.distributorLink,
      })
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update code')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-[#9B30FF]" />
        <h3 className="font-semibold text-white text-sm">Your referral code</h3>
      </div>

      {editing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value.toLowerCase())}
            maxLength={20}
            placeholder="2-20 chars, lowercase, hyphens ok"
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-white placeholder-[#555] focus:outline-none focus:border-[#9B30FF] transition-colors text-sm font-mono"
          />
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-3 py-2 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={
                saving ||
                !draft ||
                draft === participant.referral_code
              }
              className="bg-[#9B30FF] hover:bg-[#7E22CE] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full px-4 py-2 inline-flex items-center gap-2 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Save
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setDraft(participant.referral_code)
                setError('')
              }}
              className="text-sm text-[#A0A0A0] hover:text-white px-4 py-2 rounded-full border border-[#2A2A2A] hover:border-[#444] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <code className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2 text-[#9B30FF] font-mono text-sm">
            {participant.referral_code}
          </code>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-[#A0A0A0] hover:text-white inline-flex items-center gap-1.5 transition-colors"
          >
            <Edit3 className="w-3 h-3" />
            Customize
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom share message
// ---------------------------------------------------------------------------

function MessageSection({
  participant,
  consumerLink,
  onSaved,
}: {
  participant: ReferralParticipant
  consumerLink: string
  onSaved: (message: string) => void
}) {
  const defaultMessage = `Check out Untamed Beverages — premium canned vodka martinis. Use my link: ${consumerLink}`
  const [message, setMessage] = useState(
    participant.custom_message || defaultMessage
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/portal/referrals/message', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      onSaved(message)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle className="w-4 h-4 text-[#9B30FF]" />
        <h3 className="font-semibold text-white text-sm">My share message</h3>
      </div>
      <p className="text-xs text-[#A0A0A0] mb-3">
        Customize the blurb you copy into texts and DMs.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        maxLength={CUSTOM_MESSAGE_MAX_LENGTH}
        className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder-[#555] focus:outline-none focus:border-[#9B30FF] transition-colors resize-none text-sm"
      />
      <div className="flex items-center justify-between mt-2 mb-3">
        <span className="text-xs text-[#666]">
          {message.length} / {CUSTOM_MESSAGE_MAX_LENGTH}
        </span>
        {error && <span className="text-xs text-red-400">{error}</span>}
        {saved && (
          <span className="text-xs text-[#39FF14] inline-flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Saved
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#9B30FF] hover:bg-[#7E22CE] disabled:opacity-50 text-white text-sm font-semibold rounded-full px-4 py-2 inline-flex items-center gap-2 transition-colors"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          Save message
        </button>
        <button
          onClick={handleCopy}
          className="text-sm text-[#A0A0A0] hover:text-white px-4 py-2 rounded-full border border-[#2A2A2A] hover:border-[#444] transition-colors inline-flex items-center gap-2"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-[#39FF14]" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          Copy
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Warm intros (named recipient -> SES email)
// ---------------------------------------------------------------------------

function WarmIntroSection({
  invites,
  onSent,
}: {
  invites: ReferralInvite[]
  onSent: (invite: ReferralInvite) => void
}) {
  const [referredName, setReferredName] = useState('')
  const [referredEmail, setReferredEmail] = useState('')
  const [inviteType, setInviteType] = useState<'consumer' | 'distributor'>(
    'consumer'
  )
  const [customMessage, setCustomMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    setSuccess(false)

    try {
      const res = await fetch('/api/portal/referrals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referredEmail,
          referredName: referredName || undefined,
          inviteType,
          customMessage: customMessage || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')

      setSuccess(true)
      setReferredName('')
      setReferredEmail('')
      setCustomMessage('')
      if (data.invite) onSent(data.invite)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-4 h-4 text-[#9B30FF]" />
        <h3 className="font-semibold text-white text-sm">Send a warm intro</h3>
      </div>
      <p className="text-xs text-[#A0A0A0] mb-4">
        We&apos;ll email a personalized invite from the Untamed loyalty inbox.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Their name (optional)"
            value={referredName}
            onChange={(e) => setReferredName(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-white placeholder-[#555] focus:outline-none focus:border-[#9B30FF] transition-colors text-sm"
          />
          <input
            type="email"
            placeholder="Their email *"
            value={referredEmail}
            onChange={(e) => setReferredEmail(e.target.value)}
            required
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-white placeholder-[#555] focus:outline-none focus:border-[#9B30FF] transition-colors text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setInviteType('consumer')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              inviteType === 'consumer'
                ? 'border-[#9B30FF] bg-[#9B30FF]/10 text-[#9B30FF]'
                : 'border-[#2A2A2A] text-[#A0A0A0] hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Consumer
          </button>
          <button
            type="button"
            onClick={() => setInviteType('distributor')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              inviteType === 'distributor'
                ? 'border-[#FF8C2A] bg-[#FF8C2A]/10 text-[#FF8C2A]'
                : 'border-[#2A2A2A] text-[#A0A0A0] hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Retailer
          </button>
        </div>

        <textarea
          placeholder="Add a personal note (optional)"
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          rows={3}
          maxLength={CUSTOM_MESSAGE_MAX_LENGTH}
          className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder-[#555] focus:outline-none focus:border-[#9B30FF] transition-colors resize-none text-sm"
        />

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-3 py-2 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] rounded-xl px-3 py-2 text-xs">
            <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Intro sent.</span>
          </div>
        )}

        <button
          type="submit"
          disabled={sending || !referredEmail}
          className="bg-[#9B30FF] hover:bg-[#7E22CE] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full px-5 py-2.5 inline-flex items-center gap-2 transition-colors"
        >
          {sending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          Send warm intro
        </button>
      </form>

      {invites.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[#2A2A2A]">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
            Recent invites
          </h4>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {invites.map((invite) => (
              <InviteRow key={invite.id} invite={invite} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InviteRow({ invite }: { invite: ReferralInvite }) {
  const statusStyles: Record<
    ReferralInvite['status'],
    { bg: string; fg: string; label: string }
  > = {
    sent: { bg: '#9B30FF1A', fg: '#9B30FF', label: 'Sent' },
    opened: { bg: '#FFFF001A', fg: '#FFFF00', label: 'Opened' },
    clicked: { bg: '#3b82f61A', fg: '#3b82f6', label: 'Clicked' },
    converted: { bg: '#39FF141A', fg: '#39FF14', label: 'Converted' },
  }
  const s = statusStyles[invite.status]

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A]">
      <div className="min-w-0">
        <p className="text-sm text-white truncate">
          {invite.referred_name || invite.referred_email}
        </p>
        <p className="text-xs text-[#666] truncate">
          {invite.invite_type === 'consumer' ? 'Consumer' : 'Retailer'}
          {' · '}
          {new Date(invite.sent_at).toLocaleDateString()}
        </p>
      </div>
      <span
        className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ml-2"
        style={{ backgroundColor: s.bg, color: s.fg }}
      >
        {s.label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tier progress
// ---------------------------------------------------------------------------

function TierSection({
  tiers,
  rewards,
  consumerSignups,
  distributorLeads,
}: {
  tiers: ReferralRewardTier[]
  rewards: ReferralRewardEarned[]
  consumerSignups: number
  distributorLeads: number
}) {
  if (tiers.length === 0) return null

  const earnedTierIds = new Set(rewards.map((r) => r.tier_id))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-[#9B30FF]" />
        <h3 className="font-semibold text-white text-sm">Reward tiers</h3>
      </div>
      <div className="space-y-3">
        {tiers.map((tier) => {
          const earned = earnedTierIds.has(tier.id)
          const reward = rewards.find((r) => r.tier_id === tier.id)
          const signupProgress =
            tier.min_consumer_signups > 0
              ? Math.min(consumerSignups / tier.min_consumer_signups, 1)
              : 1
          const leadProgress =
            tier.min_distributor_leads > 0
              ? Math.min(distributorLeads / tier.min_distributor_leads, 1)
              : 1

          return (
            <div
              key={tier.id}
              className="bg-[#141414] border rounded-2xl p-5 transition-colors"
              style={{
                borderColor: earned ? '#9B30FF66' : '#2A2A2A',
                backgroundColor: earned ? '#9B30FF08' : '#141414',
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: earned ? '#9B30FF1A' : '#1A1A1A',
                  }}
                >
                  {earned ? (
                    <CheckCircle className="w-4 h-4 text-[#9B30FF]" />
                  ) : (
                    <Lock className="w-4 h-4 text-[#666]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white text-sm">
                    {tier.tier_name}
                  </h4>
                  {tier.description && (
                    <p className="text-xs text-[#A0A0A0]">
                      {tier.description}
                    </p>
                  )}
                </div>
                {earned && reward && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{
                      backgroundColor: reward.is_claimed
                        ? '#39FF141A'
                        : '#9B30FF1A',
                      color: reward.is_claimed ? '#39FF14' : '#9B30FF',
                    }}
                  >
                    {reward.is_claimed ? 'Claimed' : 'Earned'}
                  </span>
                )}
              </div>

              {!earned && (
                <div className="space-y-2.5">
                  {tier.min_consumer_signups > 0 && (
                    <ProgressRow
                      label="Consumer signups"
                      value={Math.min(
                        consumerSignups,
                        tier.min_consumer_signups
                      )}
                      target={tier.min_consumer_signups}
                      progress={signupProgress}
                      color="#9B30FF"
                    />
                  )}
                  {tier.min_distributor_leads > 0 && (
                    <ProgressRow
                      label="Retailer leads"
                      value={Math.min(
                        distributorLeads,
                        tier.min_distributor_leads
                      )}
                      target={tier.min_distributor_leads}
                      progress={leadProgress}
                      color="#FF8C2A"
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProgressRow({
  label,
  value,
  target,
  progress,
  color,
}: {
  label: string
  value: number
  target: number
  progress: number
  color: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[#A0A0A0]">{label}</span>
        <span className="text-white font-medium">
          {value} / {target}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#0A0A0A] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  )
}
