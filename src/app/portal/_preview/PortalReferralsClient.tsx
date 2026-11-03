'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle,
  Copy,
  Edit3,
  Gift,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  MousePointerClick,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import type { ReferralParticipant } from '@/lib/referral/types'
import { CUSTOM_MESSAGE_MAX_LENGTH } from '@/lib/referral/constants'
import { POINTS } from '@/lib/loyalty/constants'
import { CAPS, PROGRAM_RULES_PATH } from '@/lib/rewards/program'
import type { WeeklyFriends } from '@/lib/referral-hq/progress'
import { TerritoryMap } from '@/components/referral-hq/TerritoryMap'
import { WeeklyChart } from '@/components/referral-hq/WeeklyChart'

interface Props {
  initialParticipant: ReferralParticipant
  initialConsumerLink: string
  /** Referral rewards credited this calendar year (capped). */
  creditsThisYear: number
  /** Friends who joined and confirmed 21+, counted by state (counts only). */
  friendsByState: Record<string, number>
  homeState: string | null
  weekly: WeeklyFriends[]
}

/** A share message should say the member earns rewards (FTC Endorsement Guides). */
const DISCLOSURE_PATTERN = /#ad\b|reward|earn|points/i

export function PortalReferralsClient({
  initialParticipant,
  initialConsumerLink,
  creditsThisYear,
  friendsByState,
  homeState,
  weekly,
}: Props) {
  const [participant, setParticipant] =
    useState<ReferralParticipant>(initialParticipant)
  const [consumerLink, setConsumerLink] = useState(initialConsumerLink)

  const stats = useMemo(
    () => [
      {
        label: 'Link clicks',
        value: participant.total_clicks,
        icon: MousePointerClick,
      },
      {
        label: 'Friends who joined (21+)',
        value: participant.consumer_signups,
        icon: Users,
      },
      {
        label: `Rewarded this year (max ${CAPS.REFERRAL_CREDITS_PER_YEAR})`,
        value: creditsThisYear,
        icon: Gift,
      },
    ],
    [participant, creditsThisYear]
  )

  return (
    <div className="space-y-6">
      <div>
        <p className="font-condensed text-xs uppercase tracking-[0.3em] text-[#A0A0A0]">
          Referral HQ
        </p>
        <h1 className="font-wild text-5xl text-white leading-none mt-1 mb-2">
          Spread the Wild
        </h1>
        <p className="text-sm text-[#A0A0A0] max-w-3xl">
          Share your link with friends who are 21+. When a friend joins Pack
          Rewards and confirms they&apos;re 21+, you earn{' '}
          {POINTS.REFERRAL_SIGNUP.toLocaleString()} points. Nothing depends on
          what anyone buys.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-6">
          <ShareRules />
          <ShareLinkCard link={consumerLink} />
          <StatsGrid stats={stats} />
        </div>
        <div className="lg:col-span-7">
          <TerritoryMap friendsByState={friendsByState} homeState={homeState} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-6">
          <CodeSection
            participant={participant}
            onUpdated={(updated, links) => {
              setParticipant(updated)
              if (links) setConsumerLink(links.consumerLink)
            }}
          />

          <MessageSection
            participant={participant}
            consumerLink={consumerLink}
            onSaved={(message) =>
              setParticipant((p) => ({ ...p, custom_message: message }))
            }
          />
        </div>
        <div className="lg:col-span-5">
          <WeeklyChart weeks={weekly} thisYear={creditsThisYear} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sharing rules (FTC disclosure, 21+ only, no spam, no businesses)
// ---------------------------------------------------------------------------

function ShareRules() {
  const rules = [
    'Only share with people you know are 21 or older, and ask them not to pass it to anyone under 21.',
    'Say that you earn rewards, right in the post or message (for example "#ad" or "I get rewards from Untamed").',
    'Share it yourself, one-to-one or on your own profile. No spam, no texting people who haven’t agreed to hear from you, and no posting where people under 21 hang out.',
    'Don’t pitch bars, restaurants, stores, or distributors. Point them to the Retail page instead; referrals of businesses never earn rewards.',
    'Keep it responsible: no health claims, nothing about getting drunk, and never drinking with driving.',
  ]
  return (
    <div className="bg-[#141414] border border-[#9B30FF]/30 rounded-3xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-[#C89BFF]" />
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C89BFF]">How to share</h3>
      </div>
      <ul className="space-y-2 text-sm text-[#C8C8C8]">
        {rules.map((rule) => (
          <li key={rule} className="flex items-start gap-2">
            <Check className="w-4 h-4 mt-0.5 shrink-0 text-[#9B30FF]" />
            {rule}
          </li>
        ))}
      </ul>
      <p className="text-xs text-[#707070] mt-3">
        Full details in the{' '}
        <Link href={PROGRAM_RULES_PATH} className="text-[#9B30FF] underline">
          Program Rules
        </Link>
        .
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Share link
// ---------------------------------------------------------------------------

function ShareLinkCard({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)

  // Checked after mount so the server HTML and the first client render match.
  const [canShare, setCanShare] = useState(false)
  useEffect(() => {
    setCanShare(typeof navigator.share === 'function')
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  async function handleShare() {
    // The member picks the app and the recipients and writes the message.
    // Untamed never pre-writes or sends it.
    try {
      await navigator.share({ url: link })
    } catch {
      // cancelled or unsupported
    }
  }

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-3xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center">
          <Users className="w-4 h-4 text-[#9B30FF]" />
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white">Your link</h3>
          <p className="text-xs text-[#A0A0A0]">
            Friends land on the age check first, then can join.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-[#9B30FF]/10 rounded-xl px-3 py-2.5 border border-dashed border-[#9B30FF]/50 overflow-hidden">
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
        {canShare && (
          <button
            onClick={handleShare}
            className="shrink-0 w-10 h-10 rounded-xl border border-[#2A2A2A] hover:border-[#9B30FF] transition-colors flex items-center justify-center"
            title="Share"
          >
            <Share2 className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4"
        >
          <s.icon className="w-4 h-4 text-[#FFD700] mb-2" />
          <p className="font-display text-3xl font-bold text-white tabular-nums">
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
    links?: { consumerLink: string }
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
      onUpdated(data.participant, { consumerLink: data.consumerLink })
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update code')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-3xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-[#9B30FF]" />
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white">Your referral code</h3>
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
          <code className="bg-[#9B30FF]/10 border border-dashed border-[#9B30FF]/50 rounded-xl px-4 py-2 font-mono text-base tracking-wider text-white">
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
// Share message (the member's own words)
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
  // Deliberately no pre-written promotional copy: members write their own.
  const [message, setMessage] = useState(participant.custom_message || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const hasDisclosure = DISCLOSURE_PATTERN.test(message)

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
      const text = message.includes(consumerLink)
        ? message
        : `${message.trim()}\n${consumerLink}`.trim()
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-3xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle className="w-4 h-4 text-[#9B30FF]" />
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white">My share message</h3>
      </div>
      <p className="text-xs text-[#A0A0A0] mb-3">
        Save a note in your own words to paste into your own texts and DMs.
        Copying adds your link if it isn&apos;t already in the message.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        maxLength={CUSTOM_MESSAGE_MAX_LENGTH}
        placeholder="Write it your way, and mention that you get rewards from Untamed."
        className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder-[#555] focus:outline-none focus:border-[#9B30FF] transition-colors resize-none text-sm"
      />
      {message.trim() && !hasDisclosure && (
        <div className="flex items-start gap-2 text-xs text-[#FFD700] mt-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Add that you earn rewards, for example &ldquo;#ad&rdquo; or
            &ldquo;I get rewards from Untamed&rdquo;. It&apos;s required when
            you share.
          </span>
        </div>
      )}
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
          disabled={!message.trim() || !hasDisclosure}
          className="text-sm text-[#A0A0A0] hover:text-white px-4 py-2 rounded-full border border-[#2A2A2A] hover:border-[#444] transition-colors inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
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
