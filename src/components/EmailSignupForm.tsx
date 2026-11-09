'use client'

/**
 * Email signup (double opt-in) for the footer, homepage, shop, and /subscribe,
 * plus the separate opt-in checkbox other forms embed.
 *
 * Nothing here subscribes anyone: /api/email/subscribe emails a confirmation
 * link and the person is added only after clicking it. The consent and 21+
 * sentences come from src/lib/email/signup-copy.ts and are shown verbatim;
 * the server records the same text for the copy version this bundle sends.
 *
 * Cloudflare Turnstile appears only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is
 * set, and its script loads only once someone starts filling in a form.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle, Loader2, Mail, User } from 'lucide-react'
import { useTracking } from '@/components/TrackingProvider'
import {
  SIGNUP_AGE_TEXT,
  SIGNUP_COPY_VERSION,
  SIGNUP_FORMS,
  type SignupForm,
} from '@/lib/email/signup-copy'

export interface SignupListOption {
  slug: string
  name: string
  description: string | null
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

// One topic lookup per page, shared by every form on it.
let listsRequest: Promise<SignupListOption[]> | null = null

function loadSignupLists(): Promise<SignupListOption[]> {
  if (!listsRequest) {
    listsRequest = fetch('/api/email/subscribe')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !Array.isArray(data.lists)) throw new Error('Topics unavailable')
        return data.lists as SignupListOption[]
      })
      .catch((err) => {
        listsRequest = null
        throw err
      })
  }
  return listsRequest
}

let turnstileScript: Promise<void> | null = null

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (!turnstileScript) {
    turnstileScript = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = TURNSTILE_SCRIPT
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        turnstileScript = null
        script.remove()
        reject(new Error('Turnstile failed to load'))
      }
      document.head.appendChild(script)
    })
  }
  return turnstileScript
}

/**
 * Turnstile widget state. Renders into `ref` once `active` turns true; a
 * no-op when no site key is configured. `reset` clears a used token;
 * `remove` drops the widget so a freshly mounted container gets a new one.
 */
export function useTurnstile(active: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const [token, setToken] = useState('')
  const [failed, setFailed] = useState(false)
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !active || widgetId.current) return
    let cancelled = false
    loadTurnstile()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile || widgetId.current) return
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          size: 'flexible',
          callback: (t: string) => setToken(t),
          'expired-callback': () => setToken(''),
          'error-callback': () => setToken(''),
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [active, round])

  useEffect(
    () => () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    },
    []
  )

  const reset = useCallback(() => {
    setToken('')
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)
  }, [])

  const remove = useCallback(() => {
    setToken('')
    if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
    widgetId.current = null
    setRound((r) => r + 1)
  }, [])

  return { enabled: Boolean(TURNSTILE_SITE_KEY), ref, token, failed, reset, remove }
}

/** Shown under a form when Turnstile is on but hasn't produced a token. */
export function turnstileProblem(turnstile: ReturnType<typeof useTurnstile>): string | null {
  if (!turnstile.enabled || turnstile.token) return null
  return turnstile.failed
    ? 'The verification check didn’t load. Turn off any blocker for challenges.cloudflare.com and try again.'
    : 'Please wait a moment for the verification check to finish.'
}

// ---------------------------------------------------------------------------
// Newsletter form
// ---------------------------------------------------------------------------

interface EmailSignupFormProps {
  /** compact: footer strip. full: homepage, shop, /subscribe. */
  variant?: 'compact' | 'full'
  /** Where the form is shown ('footer', 'home', 'shop', 'subscribe'); kept with the opt-in. */
  placement: string
  /** Topics, when the page already loaded them; otherwise fetched. */
  lists?: SignupListOption[]
  className?: string
}

export function EmailSignupForm({
  variant = 'full',
  placement,
  lists: initialLists,
  className = '',
}: EmailSignupFormProps) {
  const compact = variant === 'compact'
  const { trackEvent } = useTracking()
  const ids = useId()

  const [lists, setLists] = useState<SignupListOption[] | null>(initialLists ?? null)
  const [listsFailed, setListsFailed] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((initialLists ?? []).map((l) => l.slug))
  )
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [active, setActive] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const turnstile = useTurnstile(active)

  const fetchLists = useCallback(() => {
    setListsFailed(false)
    loadSignupLists()
      .then((loaded) => {
        setLists(loaded)
        setSelected(new Set(loaded.map((l) => l.slug)))
      })
      .catch(() => setListsFailed(true))
  }, [])

  useEffect(() => {
    if (!initialLists) fetchLists()
  }, [initialLists, fetchLists])

  function onFormFocus() {
    if (active) return
    setActive(true)
    trackEvent('form_start', { form: 'email_signup', placement })
  }

  function toggleList(slug: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(slug)
      else next.delete(slug)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const chosen = (lists ?? []).filter((l) => selected.has(l.slug)).map((l) => l.slug)
    if (chosen.length === 0) return setError('Pick at least one topic.')
    if (!ageConfirmed) return setError('Please confirm you’re 21 or older.')
    const verifyIssue = turnstileProblem(turnstile)
    if (verifyIssue) return setError(verifyIssue)

    setSending(true)
    try {
      const res = await fetch('/api/email/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          lists: chosen,
          ageAttested: ageConfirmed,
          timezone: browserTimeZone(),
          placement,
          copyVersion: SIGNUP_COPY_VERSION,
          website: honeypot,
          turnstileToken: turnstile.token || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
      trackEvent('form_complete', { form: 'email_signup', placement })
      setSentTo(email.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      turnstile.reset()
    } finally {
      setSending(false)
    }
  }

  function startOver() {
    setSentTo(null)
    setEmail('')
    setAgeConfirmed(false)
    setError('')
    // The widget's container was unmounted with the form; render a new one.
    turnstile.remove()
  }

  if (sentTo) {
    return (
      <div role="status" className={`${compact ? 'text-left' : 'text-center'} ${className}`}>
        <div className={`flex items-start gap-3 ${compact ? '' : 'flex-col items-center'}`}>
          <CheckCircle
            className={`${compact ? 'w-5 h-5 mt-0.5' : 'w-12 h-12 mb-2'} shrink-0 text-[#9B30FF]`}
          />
          <div>
            <p className={`${compact ? 'text-base' : 'text-2xl'} font-bold text-white mb-1`}>
              Check your inbox to confirm
            </p>
            <p className="text-sm text-[#A0A0A0]">
              We sent a link to <span className="text-white break-all">{sentTo}</span>. Click it
              within 7 days to finish signing up. Don&apos;t see it? Check spam or promotions.
            </p>
            <button
              type="button"
              onClick={startOver}
              className="mt-3 text-sm text-[#A0A0A0] underline underline-offset-4 hover:text-white transition-colors"
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (lists && lists.length === 0) {
    return (
      <p className={`text-sm text-[#A0A0A0] ${className}`}>Email signups are closed right now.</p>
    )
  }

  const inputClass =
    'w-full min-w-0 py-3 bg-[#111] border border-[#2A2A2A] rounded-xl text-white text-sm placeholder:text-[#666] focus:outline-none focus:border-[#9B30FF]/70 transition-colors'

  const submitButton = (
    <button
      type="submit"
      disabled={sending || !lists}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[#9B30FF] text-white font-semibold transition-colors hover:bg-[#B560FF] disabled:opacity-50 disabled:cursor-not-allowed ${
        compact ? 'px-5 py-3 text-sm shrink-0' : 'w-full py-3.5 text-sm uppercase tracking-wider'
      }`}
    >
      {sending ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-label="Sending" />
      ) : (
        <>
          {compact ? 'Sign up' : 'Sign me up'}
          {!compact && <ArrowRight className="w-4 h-4" />}
        </>
      )}
    </button>
  )

  const topics = !lists ? (
    <p className="text-xs text-[#666]">
      {listsFailed ? (
        <>
          Topics didn&apos;t load.{' '}
          <button type="button" onClick={fetchLists} className="underline hover:text-white">
            Try again
          </button>
        </>
      ) : (
        'Loading topics…'
      )}
    </p>
  ) : compact ? (
    <fieldset>
      <legend className="sr-only">Topics</legend>
      <div className="flex flex-wrap gap-2">
        {lists.map((list) => (
          <label
            key={list.slug}
            title={list.description || undefined}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#2A2A2A] text-xs text-[#A0A0A0] cursor-pointer transition-colors has-[:checked]:border-[#9B30FF]/60 has-[:checked]:text-white"
          >
            <input
              type="checkbox"
              checked={selected.has(list.slug)}
              onChange={(e) => toggleList(list.slug, e.target.checked)}
              className="h-3.5 w-3.5 accent-[#9B30FF]"
            />
            {list.name}
          </label>
        ))}
      </div>
    </fieldset>
  ) : (
    <fieldset>
      <legend className="text-sm text-[#A0A0A0] mb-2">What do you want to hear about?</legend>
      <div className="grid sm:grid-cols-3 gap-3">
        {lists.map((list) => (
          <label
            key={list.slug}
            className="flex items-start gap-3 p-3 rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] cursor-pointer transition-colors has-[:checked]:border-[#9B30FF]/60 has-[:checked]:bg-[#9B30FF]/10"
          >
            <input
              type="checkbox"
              checked={selected.has(list.slug)}
              onChange={(e) => toggleList(list.slug, e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#9B30FF]"
            />
            <span className="text-left">
              <span className="block text-sm font-medium text-white">{list.name}</span>
              {list.description && (
                <span className="block text-xs text-[#888] mt-0.5 leading-snug">
                  {list.description}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )

  return (
    <form
      onSubmit={handleSubmit}
      onFocus={onFormFocus}
      className={`relative text-left ${compact ? 'space-y-3' : 'space-y-4'} ${className}`}
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

      {compact ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <label htmlFor={`${ids}-email`} className="sr-only">
            Email address
          </label>
          <input
            id={`${ids}-email`}
            type="email"
            required
            maxLength={320}
            autoComplete="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} flex-1 px-4`}
          />
          {submitButton}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="relative">
            <label htmlFor={`${ids}-first`} className="sr-only">
              First name (optional)
            </label>
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B30FF]" />
            <input
              id={`${ids}-first`}
              type="text"
              maxLength={60}
              autoComplete="given-name"
              placeholder="First name (optional)"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={`${inputClass} pl-11 pr-4`}
            />
          </div>
          <div className="relative">
            <label htmlFor={`${ids}-email`} className="sr-only">
              Email address
            </label>
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B30FF]" />
            <input
              id={`${ids}-email`}
              type="email"
              required
              maxLength={320}
              autoComplete="email"
              placeholder="Email *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} pl-11 pr-4`}
            />
          </div>
        </div>
      )}

      {topics}

      <label className="flex items-start gap-3 text-sm text-[#D0D0D0] cursor-pointer">
        <input
          type="checkbox"
          required
          checked={ageConfirmed}
          onChange={(e) => setAgeConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#9B30FF]"
        />
        <span>{SIGNUP_AGE_TEXT}</span>
      </label>

      <p
        className={
          compact
            ? 'text-xs text-[#888] leading-relaxed'
            : 'text-sm text-white leading-relaxed rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-4'
        }
      >
        {SIGNUP_FORMS.website.consentText}
      </p>

      {turnstile.enabled && active && <div ref={turnstile.ref} className="min-h-[65px]" />}

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {!compact && submitButton}

      <p className="text-xs text-[#666]">
        We&apos;ll email you a link to confirm first.{' '}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-[#A0A0A0]">
          Privacy Policy
        </Link>
      </p>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Opt-in checkbox for other forms
// ---------------------------------------------------------------------------

interface EmailOptInCheckboxProps {
  /** join: loyalty join form (consumer lists, needs 21+). trade: wholesale inquiry. */
  form: Exclude<SignupForm, 'website'>
  checked: boolean
  onChange: (checked: boolean) => void
  ageChecked?: boolean
  onAgeChange?: (checked: boolean) => void
  accentColor?: string
}

/**
 * Separate, unticked marketing opt-in for a form whose main purpose is
 * something else. When ticked, send `emailOptInPayload()` as the form's
 * `emailSignup` field; the API starts the same double opt-in.
 */
export function EmailOptInCheckbox({
  form,
  checked,
  onChange,
  ageChecked = false,
  onAgeChange,
  accentColor = '#9B30FF',
}: EmailOptInCheckboxProps) {
  const copy = SIGNUP_FORMS[form]
  const needsAge = copy.audience === 'consumer'

  return (
    <div className="space-y-2 text-left">
      <label className="flex items-start gap-3 text-sm text-untamed-white-muted cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            onChange(e.target.checked)
            if (!e.target.checked) onAgeChange?.(false)
          }}
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ accentColor }}
        />
        <span>{copy.consentText}</span>
      </label>
      {checked && needsAge && (
        <label className="flex items-start gap-3 pl-7 text-sm text-untamed-white-muted cursor-pointer">
          <input
            type="checkbox"
            required
            checked={ageChecked}
            onChange={(e) => onAgeChange?.(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ accentColor }}
          />
          <span>{SIGNUP_AGE_TEXT}</span>
        </label>
      )}
      {checked && (
        <p className="pl-7 text-xs text-muted">We&apos;ll email you a link to confirm first.</p>
      )}
    </div>
  )
}

/** The `emailSignup` field for a form with EmailOptInCheckbox; undefined when unticked. */
export function emailOptInPayload(checked: boolean, ageAttested = false) {
  if (!checked) return undefined
  return {
    ageAttested,
    copyVersion: SIGNUP_COPY_VERSION,
    placement: typeof window !== 'undefined' ? window.location.pathname : undefined,
    timezone: browserTimeZone(),
  }
}
