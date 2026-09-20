'use client'

import { useRef, useState } from 'react'
import {
  AtSign,
  CheckCircle,
  Globe,
  Link2,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  User,
} from 'lucide-react'
import { useTracking } from '@/components/TrackingProvider'
import { trackLead } from '@/lib/tracking/meta-pixel'
import {
  COMPENSATION_LABELS,
  COMPENSATION_PREFS,
  CONTENT_FOCUS_LABELS,
  CONTENT_FOCUSES,
  CREATOR_PURPLE,
  FOLLOWER_TIER_LABELS,
  FOLLOWER_TIERS,
  INFLUENCER_PLATFORMS,
  PLATFORM_LABELS,
  cleanHandle,
} from '@/lib/influencers/constants'
import type {
  CompensationPref,
  ContentFocus,
  FollowerTier,
  InfluencerPlatform,
} from '@/lib/influencers/types'

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

export function ApplyForm() {
  const { getAttribution, trackEvent } = useTracking()
  const formStarted = useRef(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [primaryPlatform, setPrimaryPlatform] = useState<InfluencerPlatform>('instagram')
  const [handle, setHandle] = useState('')
  const [profileUrl, setProfileUrl] = useState('')
  const [otherHandles, setOtherHandles] = useState('')
  const [followerTier, setFollowerTier] = useState<FollowerTier | ''>('')
  const [contentFocus, setContentFocus] = useState<ContentFocus | ''>('')
  const [compensation, setCompensation] = useState<CompensationPref>('open')
  const [contentLink, setContentLink] = useState('')
  const [message, setMessage] = useState('')
  const [is21, setIs21] = useState(false)
  const [audienceIs21, setAudienceIs21] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function onFormStart() {
    if (formStarted.current) return
    formStarted.current = true
    trackEvent('form_start', { form: 'influencer_apply' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const eventId = crypto.randomUUID()
    const attribution = getAttribution()

    try {
      const res = await fetch('/api/influencers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          location: location || undefined,
          primaryPlatform,
          handle: cleanHandle(handle),
          profileUrl,
          otherHandles: otherHandles || undefined,
          followerTier,
          contentFocus,
          compensation,
          contentLink: contentLink || undefined,
          message: message || undefined,
          is21,
          audienceIs21,
          website: honeypot,
          event_id: eventId,
          fbp: readCookie('_fbp'),
          fbc: readCookie('_fbc'),
          ...attribution,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to submit')

      trackLead({
        eventID: eventId,
        content_name: cleanHandle(handle) || name,
        content_category: `influencer_${primaryPlatform}`,
      })
      trackEvent('form_complete', { form: 'influencer_apply', event_id: eventId })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="p-8 sm:p-10 text-center">
        <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: CREATOR_PURPLE }} />
        <h3 className="text-2xl font-bold text-white mb-2">Application received</h3>
        <p className="text-untamed-white-muted max-w-md mx-auto">
          We’ll look at your page and follow up within a few days — whether it’s a yes, a not now, or a question.
        </p>
      </div>
    )
  }

  const inputClass =
    'w-full pl-12 pr-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white placeholder:text-muted focus:outline-none transition-colors'
  const selectClass =
    'w-full px-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white focus:outline-none transition-colors appearance-none'
  const iconClass = 'absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5'
  const iconStyle = { color: CREATOR_PURPLE }

  return (
    <form onSubmit={handleSubmit} onFocus={onFormStart} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="relative">
          <User className={iconClass} style={iconStyle} />
          <input
            type="text"
            placeholder="Your name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            className={inputClass}
          />
        </div>
        <div className="relative">
          <Mail className={iconClass} style={iconStyle} />
          <input
            type="email"
            placeholder="Email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="relative">
          <Phone className={iconClass} style={iconStyle} />
          <input
            type="tel"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            className={inputClass}
          />
        </div>
        <div className="relative">
          <MapPin className={iconClass} style={iconStyle} />
          <input
            type="text"
            placeholder="City, State *"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            autoComplete="address-level2"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-1.5">Primary platform *</label>
          <select
            value={primaryPlatform}
            onChange={(e) => setPrimaryPlatform(e.target.value as InfluencerPlatform)}
            className={selectClass}
          >
            {INFLUENCER_PLATFORMS.map((value) => (
              <option key={value} value={value}>
                {PLATFORM_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <AtSign className={iconClass} style={iconStyle} />
          <input
            type="text"
            placeholder="Handle *"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="relative">
        <Globe className={iconClass} style={iconStyle} />
        <input
          type="text"
          placeholder="Profile URL *  (instagram.com/you)"
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div className="relative">
        <AtSign className={iconClass} style={iconStyle} />
        <input
          type="text"
          placeholder="Other handles (TikTok, YouTube, etc.)"
          value={otherHandles}
          onChange={(e) => setOtherHandles(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-1.5">Followers *</label>
          <select
            value={followerTier}
            onChange={(e) => setFollowerTier(e.target.value as FollowerTier)}
            required
            className={selectClass}
          >
            <option value="">Select range...</option>
            {FOLLOWER_TIERS.map((value) => (
              <option key={value} value={value}>
                {FOLLOWER_TIER_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1.5">Content focus *</label>
          <select
            value={contentFocus}
            onChange={(e) => setContentFocus(e.target.value as ContentFocus)}
            required
            className={selectClass}
          >
            <option value="">Select...</option>
            {CONTENT_FOCUSES.map((value) => (
              <option key={value} value={value}>
                {CONTENT_FOCUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm text-muted-foreground mb-1.5">How you’d like to work</label>
        <select
          value={compensation}
          onChange={(e) => setCompensation(e.target.value as CompensationPref)}
          className={selectClass}
        >
          {COMPENSATION_PREFS.map((value) => (
            <option key={value} value={value}>
              {COMPENSATION_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <Link2 className={iconClass} style={iconStyle} />
        <input
          type="text"
          placeholder="A post you’re proud of (URL)"
          value={contentLink}
          onChange={(e) => setContentLink(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="relative">
        <MessageSquare className="absolute left-4 top-4 w-5 h-5" style={iconStyle} />
        <textarea
          placeholder="Why Untamed — and what you’d make"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={2000}
          className="w-full pl-12 pr-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white placeholder:text-muted focus:outline-none transition-colors resize-none"
        />
      </div>

      <label className="sr-only" aria-hidden="true">
        Website
        <input
          type="text"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </label>

      <label className="flex items-start gap-3 text-sm text-untamed-white-muted cursor-pointer">
        <input
          type="checkbox"
          checked={is21}
          onChange={(e) => setIs21(e.target.checked)}
          required
          className="mt-1"
        />
        <span>I am 21 or older. *</span>
      </label>
      <label className="flex items-start gap-3 text-sm text-untamed-white-muted cursor-pointer">
        <input
          type="checkbox"
          checked={audienceIs21}
          onChange={(e) => setAudienceIs21(e.target.checked)}
          required
          className="mt-1"
        />
        <span>My audience is 21+. Paid posts will be disclosed. *</span>
      </label>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name || !email || !handle || !profileUrl || !followerTier || !contentFocus || !is21 || !audienceIs21}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-bold text-white uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: CREATOR_PURPLE,
          boxShadow: '0 0 20px rgba(155, 48, 255, 0.3)',
        }}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Send className="w-5 h-5" />
            Submit application
          </>
        )}
      </button>
    </form>
  )
}
