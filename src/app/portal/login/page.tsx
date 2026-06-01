'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
} from 'lucide-react'

export default function PortalLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#9B30FF] animate-spin" />
        </div>
      }
    >
      <PortalLoginForm />
    </Suspense>
  )
}

type Mode = 'password' | 'magic-link' | 'code'

function PortalLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const initialEmail = searchParams.get('email') || ''
  const returnTo = searchParams.get('returnTo') || '/portal'

  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash || ''
    const hasOtpError =
      hash.includes('otp_expired') ||
      hash.includes('access_denied') ||
      hash.includes('error=')
    if (hasOtpError) {
      setMode('code')
      setError(
        'Your magic link expired or was pre-opened. Enter the 6-digit code from your email instead.'
      )
    }
  }, [])

  function readableError(message: string): string {
    if (!message) return 'Something went wrong. Please try again.'
    const m = message.toLowerCase()
    if (m.includes('invalid login') || m.includes('invalid_credentials')) {
      return 'Incorrect email or password. Try again, or use a magic link.'
    }
    if (m.includes('email not confirmed')) {
      return 'Please confirm your email before signing in.'
    }
    if (m.includes('user not found')) {
      return 'No account yet. Use "Email me a magic link" below to create one.'
    }
    if (m.includes('rate limit')) {
      return 'Too many attempts. Please wait a moment before trying again.'
    }
    return message
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError(readableError(authError.message))
      setLoading(false)
      return
    }

    await fetch('/api/portal/link-identities', { method: 'POST' }).catch(() => {})

    router.push(returnTo)
    router.refresh()
  }

  async function handleSendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')

    const origin =
      typeof window !== 'undefined' ? window.location.origin : ''
    const redirectTo = `${origin}/portal/auth/callback?returnTo=${encodeURIComponent(returnTo)}`

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    })

    if (otpError) {
      setError(readableError(otpError.message))
      setLoading(false)
      return
    }

    setInfo(
      `Check ${email.trim()} for a sign-in link or 6-digit code. The link expires in 15 minutes.`
    )
    setMode('code')
    setLoading(false)
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')

    const cleanCode = code.replace(/\s+/g, '').trim()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: cleanCode,
      type: 'email',
    })

    if (verifyError) {
      setError(readableError(verifyError.message))
      setLoading(false)
      return
    }

    await fetch('/api/portal/link-identities', { method: 'POST' }).catch(() => {})

    router.push(returnTo)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="font-headline text-3xl font-bold uppercase tracking-wider text-white inline-block"
          >
            Untamed
          </Link>
          <p className="text-[#A0A0A0] mt-2">Sign in to your member portal</p>
        </div>

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8 space-y-6">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="flex items-start gap-2 bg-[#9B30FF]/10 border border-[#9B30FF]/30 text-[#C68BFF] rounded-xl px-4 py-3 text-sm">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-5">
              <EmailField email={email} setEmail={setEmail} />

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[#A0A0A0] mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 pr-12 text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-[#9B30FF] text-white font-semibold rounded-full px-6 py-3 flex items-center justify-center gap-2 hover:bg-[#7E22CE] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('magic-link')
                    setError('')
                    setInfo('')
                  }}
                  className="text-sm text-[#A0A0A0] hover:text-white inline-flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email me a magic link instead
                </button>
              </div>
            </form>
          )}

          {mode === 'magic-link' && (
            <form onSubmit={handleSendMagicLink} className="space-y-5">
              <EmailField email={email} setEmail={setEmail} />
              <p className="text-xs text-[#A0A0A0]">
                We&apos;ll email you a sign-in link and a 6-digit code. New here?
                We&apos;ll create your account automatically.
              </p>
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-[#9B30FF] text-white font-semibold rounded-full px-6 py-3 flex items-center justify-center gap-2 hover:bg-[#7E22CE] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {loading ? 'Sending...' : 'Email me a magic link'}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('password')
                    setError('')
                    setInfo('')
                  }}
                  className="text-sm text-[#A0A0A0] hover:text-white inline-flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Use password instead
                </button>
              </div>
            </form>
          )}

          {mode === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <EmailField email={email} setEmail={setEmail} />
              <div>
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-[#A0A0A0] mb-2"
                >
                  6-digit code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  required
                  autoFocus
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors"
                  placeholder="000000"
                />
              </div>
              <button
                type="submit"
                disabled={loading || code.length !== 6 || !email}
                className="w-full bg-[#9B30FF] text-white font-semibold rounded-full px-6 py-3 flex items-center justify-center gap-2 hover:bg-[#7E22CE] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {loading ? 'Verifying...' : 'Verify code'}
              </button>
              <div className="text-center space-y-1">
                <button
                  type="button"
                  onClick={() => handleSendMagicLink(new Event('submit') as unknown as React.FormEvent)}
                  className="text-sm text-[#A0A0A0] hover:text-white inline-flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Resend code
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('password')
                      setError('')
                      setInfo('')
                    }}
                    className="text-xs text-[#666] hover:text-white"
                  >
                    Use password instead
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-[#666] mt-6">
          By signing in you agree to Untamed&apos;s{' '}
          <Link href="/terms" className="underline hover:text-white">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:text-white">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

function EmailField({
  email,
  setEmail,
}: {
  email: string
  setEmail: (v: string) => void
}) {
  return (
    <div>
      <label
        htmlFor="email"
        className="block text-sm font-medium text-[#A0A0A0] mb-2"
      >
        Email
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors"
        placeholder="you@example.com"
      />
    </div>
  )
}
