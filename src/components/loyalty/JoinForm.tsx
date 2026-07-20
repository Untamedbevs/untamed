'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, User, Loader2, ArrowRight, CheckCircle, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Drink } from '@/lib/drinks'

interface JoinFormProps {
  /** Optional drink context (sets favorite drink + default theming). */
  drink?: Drink
  visitorId?: string
  accentColor?: string
  accentGlow?: string
  /** Where to send the new member after they verify. Defaults to /portal. */
  redirectTo?: string
}

type Step = 'details' | 'code'

const DEFAULT_COLOR = '#FFD700'
const DEFAULT_GLOW = 'rgba(255, 215, 0, 0.3)'

export function JoinForm({
  drink,
  visitorId,
  accentColor,
  accentGlow,
  redirectTo = '/portal',
}: JoinFormProps) {
  const color = accentColor || drink?.color || DEFAULT_COLOR
  const glow = accentGlow || drink?.colorGlow || DEFAULT_GLOW
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('details')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  function readableError(message: string): string {
    if (!message) return 'Something went wrong. Please try again.'
    const m = message.toLowerCase()
    if (m.includes('invalid') && m.includes('token')) {
      return 'That code is incorrect or expired. Check your email or resend.'
    }
    if (m.includes('rate limit')) {
      return 'Too many attempts. Please wait a moment before trying again.'
    }
    return message
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')

    const origin =
      typeof window !== 'undefined' ? window.location.origin : ''
    const emailRedirectTo = `${origin}/portal/auth/callback?returnTo=${encodeURIComponent(
      redirectTo
    )}`

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo,
        data: {
          first_name: firstName.trim() || null,
          favorite_drink_slug: drink?.slug || null,
          visitor_id: visitorId || null,
        },
      },
    })

    if (otpError) {
      setError(readableError(otpError.message))
      setLoading(false)
      return
    }

    setInfo(
      `Check ${email.trim()} — tap the sign-in link to finish. If your email also included a 6-digit code, you can enter it below instead.`
    )
    setStep('code')
    setLoading(false)
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const cleanCode = code.replace(/\s+/g, '').trim()
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: cleanCode,
      type: 'email',
    })

    if (verifyError) {
      setError(readableError(verifyError.message))
      setLoading(false)
      return
    }

    // Provision the loyalty member + referral link + credit any referrer.
    await fetch('/api/portal/link-identities', { method: 'POST' }).catch(() => {})

    const meta = data.user?.user_metadata || {}
    const needsPassword =
      meta.has_password !== true && meta.password_setup_skipped !== true
    router.push(
      needsPassword
        ? `/portal/setup-password?returnTo=${encodeURIComponent(redirectTo)}`
        : redirectTo
    )
    router.refresh()
  }

  if (step === 'code') {
    return (
      <form onSubmit={handleVerify} className="space-y-4 w-full max-w-md">
        {info && (
          <div className="flex items-start gap-2 text-sm text-untamed-white-muted">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} />
            <span>{info}</span>
          </div>
        )}

        <div className="relative">
          <KeyRound
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
            style={{ color }}
          />
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            autoFocus
            className="w-full pl-12 pr-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white text-center text-xl tracking-[0.4em] font-mono placeholder:text-muted placeholder:tracking-normal placeholder:text-base focus:outline-none transition-colors"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-bold text-black uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: color, boxShadow: `0 0 20px ${glow}` }}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Verify &amp; Join
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setStep('details')
            setCode('')
            setError('')
            setInfo('')
          }}
          className="w-full text-untamed-white-muted text-sm hover:text-untamed-white transition-colors"
        >
          Use a different email
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSendCode} className="space-y-4 w-full max-w-md">
      <div className="relative">
        <User
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
          style={{ color }}
        />
        <input
          type="text"
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white placeholder:text-muted focus:outline-none transition-colors"
        />
      </div>

      <div className="relative">
        <Mail
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
          style={{ color }}
        />
        <input
          type="email"
          placeholder="Email (the one you order with)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full pl-12 pr-4 py-3.5 bg-untamed-black-light border border-card-border rounded-xl text-white placeholder:text-muted focus:outline-none transition-colors"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !email}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-bold text-black uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 20px ${glow}`,
        }}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            Join the Pack
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>

      <p className="text-xs text-muted text-center">
        We&apos;ll email you a secure sign-in link to confirm. No password needed.
      </p>
    </form>
  )
}
