'use client'

import { useState } from 'react'
import {
  Share2, MessageCircle, Mail, Copy, Check,
  Loader2, Send, Users, Building2,
} from 'lucide-react'
import type { ReferralInvite, InviteType } from '@/lib/referral/types'

interface ShareTabsProps {
  consumerLink: string
  distributorLink: string
  customMessage: string | null
  email: string
  invites: ReferralInvite[]
  onMessageSaved: (message: string) => void
  onInviteSent: (invite: ReferralInvite) => void
}

type Tab = 'quick' | 'message' | 'warmintro'

export function ShareTabs({
  consumerLink,
  distributorLink,
  customMessage,
  email,
  invites,
  onMessageSaved,
  onInviteSent,
}: ShareTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('quick')
  const [message, setMessage] = useState(
    customMessage ||
      `Check out Untamed Beverages - premium canned vodka martinis! Use my link: ${consumerLink}`
  )
  const [messageSaving, setMessageSaving] = useState(false)
  const [messageCopied, setMessageCopied] = useState(false)

  const [introName, setIntroName] = useState('')
  const [introEmail, setIntroEmail] = useState('')
  const [introType, setIntroType] = useState<InviteType>('consumer')
  const [introSending, setIntroSending] = useState(false)
  const [introError, setIntroError] = useState('')
  const [introSuccess, setIntroSuccess] = useState(false)

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'quick', label: 'Quick Share', icon: <Share2 className="w-4 h-4" /> },
    { id: 'message', label: 'My Message', icon: <MessageCircle className="w-4 h-4" /> },
    { id: 'warmintro', label: 'Warm Intro', icon: <Mail className="w-4 h-4" /> },
  ]

  async function handleSaveMessage() {
    setMessageSaving(true)
    try {
      const res = await fetch('/api/referral/message', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message }),
      })
      if (res.ok) onMessageSaved(message)
    } finally {
      setMessageSaving(false)
    }
  }

  async function handleCopyMessage() {
    await navigator.clipboard.writeText(message)
    setMessageCopied(true)
    setTimeout(() => setMessageCopied(false), 2000)
  }

  async function handleSendIntro(e: React.FormEvent) {
    e.preventDefault()
    setIntroSending(true)
    setIntroError('')
    setIntroSuccess(false)

    try {
      const res = await fetch('/api/referral/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          referredEmail: introEmail,
          referredName: introName,
          inviteType: introType,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send')
      }
      const data = await res.json()
      setIntroSuccess(true)
      setIntroName('')
      setIntroEmail('')
      if (data.invite) onInviteSent(data.invite)
    } catch (err) {
      setIntroError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIntroSending(false)
    }
  }

  function shareUrl(platform: string) {
    const text = encodeURIComponent(`Check out Untamed Beverages!`)
    const url = encodeURIComponent(consumerLink)
    const links: Record<string, string> = {
      x: `https://x.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      sms: `sms:?body=${encodeURIComponent(`Check out Untamed Beverages! ${consumerLink}`)}`,
      email: `mailto:?subject=${encodeURIComponent('You need to try Untamed')}&body=${encodeURIComponent(`Check out Untamed Beverages - premium canned vodka martinis!\n\n${consumerLink}`)}`,
    }
    window.open(links[platform], '_blank')
  }

  return (
    <div className="rounded-2xl border-2 border-card-border bg-untamed-black-card overflow-hidden">
      {/* Tab headers */}
      <div className="flex border-b border-card-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-white bg-untamed-black-light border-b-2 border-yellow-400'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'quick' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share your consumer referral link on social media
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'x', label: 'X / Twitter', color: '#1DA1F2' },
                { id: 'facebook', label: 'Facebook', color: '#4267B2' },
                { id: 'sms', label: 'Text Message', color: '#22c55e' },
                { id: 'email', label: 'Email', color: '#FF8C2A' },
              ].map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => shareUrl(platform.id)}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl border border-card-border bg-untamed-black text-white text-sm font-medium transition-all hover:scale-[1.02]"
                  style={{ borderColor: `${platform.color}33` }}
                >
                  <Share2 className="w-4 h-4" style={{ color: platform.color }} />
                  {platform.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'message' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Customize your share message for DMs and texts
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full px-4 py-3 bg-untamed-black border border-card-border rounded-xl text-white placeholder:text-muted focus:outline-none resize-none text-sm"
            />
            <div className="flex gap-3">
              <button
                onClick={handleSaveMessage}
                disabled={messageSaving}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-yellow-400 text-black font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                {messageSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Message'}
              </button>
              <button
                onClick={handleCopyMessage}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-card-border text-white text-sm font-medium transition-all hover:bg-untamed-black-light"
              >
                {messageCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                Copy
              </button>
            </div>
          </div>
        )}

        {activeTab === 'warmintro' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send a personal referral to someone you know
            </p>
            <form onSubmit={handleSendIntro} className="space-y-3">
              <input
                type="text"
                placeholder="Their name"
                value={introName}
                onChange={(e) => setIntroName(e.target.value)}
                className="w-full px-4 py-3 bg-untamed-black border border-card-border rounded-xl text-white placeholder:text-muted focus:outline-none text-sm"
              />
              <input
                type="email"
                placeholder="Their email"
                value={introEmail}
                onChange={(e) => setIntroEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-untamed-black border border-card-border rounded-xl text-white placeholder:text-muted focus:outline-none text-sm"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIntroType('consumer')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                    introType === 'consumer'
                      ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                      : 'border-card-border text-muted-foreground hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Consumer
                </button>
                <button
                  type="button"
                  onClick={() => setIntroType('distributor')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                    introType === 'distributor'
                      ? 'border-orange-400 bg-orange-400/10 text-orange-400'
                      : 'border-card-border text-muted-foreground hover:text-white'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Distributor
                </button>
              </div>

              {introError && <p className="text-red-400 text-sm">{introError}</p>}
              {introSuccess && <p className="text-green-400 text-sm">Intro sent successfully!</p>}

              <button
                type="submit"
                disabled={introSending || !introEmail}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-yellow-400 text-black font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                {introSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Warm Intro
                  </>
                )}
              </button>
            </form>

            {invites.length > 0 && (
              <div className="mt-6 pt-4 border-t border-card-border">
                <h4 className="text-sm font-semibold text-white mb-3">Sent Invites</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-untamed-black border border-card-border text-sm"
                    >
                      <div>
                        <span className="text-white">{invite.referred_name || invite.referred_email}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {invite.invite_type === 'consumer' ? 'Consumer' : 'Distributor'}
                        </span>
                      </div>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor:
                            invite.status === 'converted' ? '#22c55e1A'
                            : invite.status === 'clicked' ? '#3b82f61A'
                            : '#FFD7001A',
                          color:
                            invite.status === 'converted' ? '#22c55e'
                            : invite.status === 'clicked' ? '#3b82f6'
                            : '#FFD700',
                        }}
                      >
                        {invite.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
