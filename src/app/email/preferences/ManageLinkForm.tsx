'use client'

/**
 * "Email me a link" for the preference center. The answer is the same
 * whether or not the address is on file, so it can't be used to look people up.
 */

import { useState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { turnstileProblem, useTurnstile } from '@/components/EmailSignupForm'

export function ManageLinkForm() {
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [active, setActive] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const turnstile = useTurnstile(active)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const verifyIssue = turnstileProblem(turnstile)
    if (verifyIssue) return setError(verifyIssue)

    setSending(true)
    try {
      const res = await fetch('/api/email/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_link',
          email: email.trim(),
          website: honeypot,
          turnstileToken: turnstile.token || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      turnstile.reset()
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div role="status" className="rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-4 text-left">
        <p className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
          <CheckCircle className="w-4 h-4 text-[#9B30FF]" />
          Check your inbox
        </p>
        <p className="text-sm text-[#A0A0A0]">
          If <span className="text-white break-all">{email.trim()}</span> gets Untamed emails,
          we&apos;ve sent it a link to manage them. It can take a few minutes to arrive.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      onFocus={() => setActive(true)}
      className="relative space-y-3 text-left"
    >
      {/* Honeypot: hidden from people, bots fill it in */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <label htmlFor="manage-link-email" className="sr-only">
        Email address
      </label>
      <input
        id="manage-link-email"
        type="email"
        required
        maxLength={320}
        autoComplete="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl text-white text-sm placeholder:text-[#666] focus:outline-none focus:border-[#9B30FF]/70 transition-colors"
      />

      {turnstile.enabled && active && <div ref={turnstile.ref} className="min-h-[65px]" />}

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="w-full inline-flex items-center justify-center px-5 py-3 rounded-full bg-[#9B30FF] text-white text-sm font-medium hover:bg-[#B560FF] transition-colors disabled:opacity-50"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Sending" /> : 'Email me a link'}
      </button>
    </form>
  )
}
