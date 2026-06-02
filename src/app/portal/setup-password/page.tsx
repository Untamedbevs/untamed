'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from 'lucide-react'

export default function SetupPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#9B30FF] animate-spin" />
        </div>
      }
    >
      <SetupPasswordForm />
    </Suspense>
  )
}

function SetupPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const returnTo = searchParams.get('returnTo') || '/portal'
  const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/portal'

  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      if (!data.user) {
        router.replace(
          `/portal/login?returnTo=${encodeURIComponent(safeReturnTo)}`
        )
        return
      }
      setChecking(false)
    })
    return () => {
      active = false
    }
  }, [router, safeReturnTo, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Use at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords don\u2019t match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { has_password: true },
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    router.push(safeReturnTo)
    router.refresh()
  }

  async function handleSkip() {
    setLoading(true)
    // Remember the choice so we don't prompt again on every sign-in.
    await supabase.auth
      .updateUser({ data: { password_setup_skipped: true } })
      .catch(() => {})
    router.push(safeReturnTo)
    router.refresh()
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#9B30FF] animate-spin" />
      </div>
    )
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
          <p className="text-[#A0A0A0] mt-2">Secure your account</p>
        </div>

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#9B30FF]/15 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#C68BFF]" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">Set a password</h1>
              <p className="text-[#A0A0A0] text-sm">
                Optional, but it makes signing in faster next time.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                  autoFocus
                  autoComplete="new-password"
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 pr-12 text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors"
                  placeholder="At least 6 characters"
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

            <div>
              <label
                htmlFor="confirm"
                className="block text-sm font-medium text-[#A0A0A0] mb-2"
              >
                Confirm password
              </label>
              <input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder-[#666] focus:outline-none focus:border-[#9B30FF] transition-colors"
                placeholder="Re-enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full bg-[#9B30FF] text-white font-semibold rounded-full px-6 py-3 flex items-center justify-center gap-2 hover:bg-[#7E22CE] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              {loading ? 'Saving...' : 'Save password'}
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={handleSkip}
              disabled={loading}
              className="text-sm text-[#A0A0A0] hover:text-white transition-colors disabled:opacity-50"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
