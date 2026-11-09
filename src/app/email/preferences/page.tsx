import Link from 'next/link'
import type { Metadata } from 'next'
import { AlertCircle, Mail } from 'lucide-react'
import { maskEmail, verifyManageToken } from '@/lib/messaging/unsubscribe'
import { normalizeEmail } from '@/lib/email/signup'
import { PREFERENCES_CONSENT_TEXT, SIGNUP_AGE_TEXT } from '@/lib/email/signup-copy'
import { isReceiving, loadPreferenceState, type PreferenceList, type PreferenceState } from './state'
import { ManageLinkForm } from './ManageLinkForm'

// Server-rendered; every change is a POST to /api/email/preferences, so
// opening the link (or a mail scanner opening it) changes nothing.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Email preferences | Untamed Beverages',
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: Promise<{ status?: string; t?: string }>
}

const NOTICES: Record<string, { tone: 'ok' | 'warn'; text: string }> = {
  saved: { tone: 'ok', text: 'Your topics are saved.' },
  paused: { tone: 'ok', text: 'Marketing email is paused.' },
  resumed: { tone: 'ok', text: 'Marketing email is back on.' },
  birthday: { tone: 'ok', text: 'Birthday saved.' },
  unsubscribed: { tone: 'ok', text: 'You’re unsubscribed from all Untamed marketing email.' },
  age_required: { tone: 'warn', text: 'Please confirm you’re 21 or older to turn on 21+ topics.' },
  birthday_invalid: {
    tone: 'warn',
    text: 'That date doesn’t exist. Pick a month and a day, or leave both blank.',
  },
  no_contact: {
    tone: 'warn',
    text: 'Turn on a topic first, then you can pause emails or add a birthday.',
  },
  blocked: { tone: 'warn', text: 'Topics can’t be turned on for this address. See the note below.' },
  failed: { tone: 'warn', text: 'We couldn’t save that just now. Please try again in a minute.' },
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function emailFromToken(token: string): string | null {
  try {
    return normalizeEmail(verifyManageToken(token)?.e)
  } catch {
    return null
  }
}

function formatDate(iso: string, timeZone: string | null): string {
  const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      ...options,
      timeZone: timeZone || 'America/New_York',
    })
  } catch {
    return new Date(iso).toLocaleDateString('en-US', options)
  }
}

export default async function EmailPreferencesPage({ searchParams }: Props) {
  const params = await searchParams
  const status = params.status
  const token = params.t

  if (!token) {
    return (
      <Wrapper>
        <Header />
        <p className="text-sm text-[#A0A0A0] mb-6 text-center">
          Enter your email and we&apos;ll send you a link to choose your topics, pause emails, or
          unsubscribe.
        </p>
        {status === 'invalid' && (
          <Notice tone="warn">That link isn&apos;t valid. Request a new one below.</Notice>
        )}
        <ManageLinkForm />
        <Footer />
      </Wrapper>
    )
  }

  const email = emailFromToken(token)
  if (!email) {
    return (
      <Wrapper>
        <Header error title="This link isn’t valid" />
        <p className="text-sm text-[#A0A0A0] mb-6 text-center">
          This preferences link is incomplete or has been changed. Enter your email and we&apos;ll
          send you a new one.
        </p>
        <ManageLinkForm />
        <Footer />
      </Wrapper>
    )
  }

  let state: PreferenceState
  try {
    state = await loadPreferenceState(email)
  } catch (err) {
    console.error('[email/preferences] load failed:', err instanceof Error ? err.message : err)
    return (
      <Wrapper>
        <Header error title="Something went wrong" />
        <p className="text-sm text-[#A0A0A0] mb-6 text-center">
          We couldn&apos;t load your preferences just now. Please try again in a minute, or email{' '}
          <a href="mailto:support@untamedbeverages.com" className="text-[#9B30FF] hover:underline">
            support@untamedbeverages.com
          </a>
          .
        </p>
        <Footer />
      </Wrapper>
    )
  }

  const notice = status ? NOTICES[status] : undefined
  const hasAgeLists = state.lists.some((l) => l.requires_age_verification)

  return (
    <Wrapper>
      <Header />
      <p className="text-sm text-[#A0A0A0] mb-6 text-center">
        For <span className="text-white font-mono">{maskEmail(email)}</span>
      </p>

      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {state.blocked && (
        <Notice tone="warn">
          Marketing email to this address is switched off after a delivery problem or an earlier
          request, so topics can&apos;t be turned on here. To turn it back on, email{' '}
          <a href="mailto:support@untamedbeverages.com" className="underline">
            support@untamedbeverages.com
          </a>
          .
        </Notice>
      )}

      <Section title="Topics">
        {state.suppression === 'unsubscribe' && (
          <p className="text-sm text-[#A0A0A0] mb-4">
            You&apos;re unsubscribed from everything. Turn on a topic to start getting it again.
          </p>
        )}
        <form method="post" action="/api/email/preferences">
          <input type="hidden" name="t" value={token} />
          <input type="hidden" name="action" value="topics" />
          <div className="space-y-3">
            {state.lists.map((list) => (
              <TopicToggle
                key={list.slug}
                list={list}
                on={isReceiving(state, list)}
                awaitingAge={list.requires_age_verification && !state.ageVerified}
                disabled={state.blocked}
              />
            ))}
          </div>

          {!state.blocked && (
            <>
              {!state.ageVerified && hasAgeLists && (
                <label className="flex items-start gap-3 text-sm text-[#D0D0D0] mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    name="age"
                    value="yes"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#9B30FF]"
                  />
                  <span>
                    {SIGNUP_AGE_TEXT}{' '}
                    <span className="text-[#666]">Needed to turn on topics marked 21+.</span>
                  </span>
                </label>
              )}
              <p className="text-sm text-white leading-relaxed mt-4 mb-4 rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-4">
                {PREFERENCES_CONSENT_TEXT}
              </p>
              <PrimaryButton>Save topics</PrimaryButton>
            </>
          )}
        </form>
      </Section>

      {state.contactId && (
        <Section title="Take a break">
          <form method="post" action="/api/email/preferences">
            <input type="hidden" name="t" value={token} />
            {state.pausedUntil ? (
              <>
                <input type="hidden" name="action" value="resume" />
                <p className="text-sm text-[#A0A0A0] mb-4">
                  Marketing email is paused until{' '}
                  <span className="text-white">{formatDate(state.pausedUntil, state.timezone)}</span>.
                </p>
                <SecondaryButton>Resume now</SecondaryButton>
              </>
            ) : (
              <>
                <input type="hidden" name="action" value="pause" />
                <p className="text-sm text-[#A0A0A0] mb-4">
                  Pause all marketing email for a while. Your topics stay as they are.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <SecondaryButton name="days" value="30">
                    Pause 30 days
                  </SecondaryButton>
                  <SecondaryButton name="days" value="90">
                    Pause 90 days
                  </SecondaryButton>
                </div>
              </>
            )}
          </form>
        </Section>
      )}

      {state.contactId && (
        <Section title="Birthday (optional)">
          <form method="post" action="/api/email/preferences">
            <input type="hidden" name="t" value={token} />
            <input type="hidden" name="action" value="birthday" />
            <p className="text-sm text-[#A0A0A0] mb-4">
              Month and day only. We may send a little something to celebrate.
            </p>
            <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_6rem_auto] gap-3">
              <label className="sr-only" htmlFor="birthday-month">
                Month
              </label>
              <select
                id="birthday-month"
                name="month"
                defaultValue={state.birthdayMonth ?? ''}
                className="col-span-2 sm:col-span-1 px-3 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] text-sm text-white focus:outline-none focus:border-[#9B30FF]/70"
              >
                <option value="">Month</option>
                {MONTHS.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="birthday-day">
                Day
              </label>
              <select
                id="birthday-day"
                name="day"
                defaultValue={state.birthdayDay ?? ''}
                className="px-3 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#2A2A2A] text-sm text-white focus:outline-none focus:border-[#9B30FF]/70"
              >
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <SecondaryButton>Save</SecondaryButton>
            </div>
          </form>
        </Section>
      )}

      <Section title="Unsubscribe from everything">
        <form method="post" action="/api/email/preferences">
          <input type="hidden" name="t" value={token} />
          <input type="hidden" name="action" value="unsubscribe_all" />
          <p className="text-sm text-[#A0A0A0] mb-4">
            Stops all Untamed marketing email. Emails about an order, your account, or your rewards
            may still be sent.
          </p>
          <button
            type="submit"
            className="w-full px-5 py-3 rounded-full border border-red-500/40 text-red-300 text-sm font-medium hover:bg-red-500/10 hover:border-red-500/60 transition-colors"
          >
            Unsubscribe from all marketing email
          </button>
        </form>
      </Section>

      <Footer />
    </Wrapper>
  )
}

function TopicToggle({
  list,
  on,
  awaitingAge,
  disabled,
}: {
  list: PreferenceList
  on: boolean
  /** 21+ list and no 21+ attestation on file: subscribed, but nothing is sent yet. */
  awaitingAge: boolean
  disabled: boolean
}) {
  return (
    <label
      className={`flex items-start justify-between gap-4 p-4 rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] ${
        disabled ? 'opacity-50' : 'cursor-pointer hover:border-[#3A3A3A]'
      }`}
    >
      <span className="text-left">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-white">
          {list.name}
          {list.requires_age_verification && (
            <span className="px-1.5 py-0.5 rounded border border-[#2A2A2A] text-[10px] font-semibold text-[#888]">
              21+
            </span>
          )}
        </span>
        {list.description && (
          <span className="block text-xs text-[#888] mt-1 leading-snug">{list.description}</span>
        )}
        <span className={`block text-xs mt-2 ${on ? 'text-[#C084FC]' : 'text-[#666]'}`}>
          {on ? (awaitingAge ? 'Subscribed, waiting for 21+ confirmation' : 'Subscribed') : 'Not subscribed'}
        </span>
      </span>
      <span className="relative inline-flex shrink-0 mt-0.5">
        <input
          type="checkbox"
          name="list"
          value={list.slug}
          defaultChecked={on}
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="block w-11 h-6 rounded-full bg-[#2A2A2A] transition-colors peer-checked:bg-[#9B30FF] peer-focus-visible:ring-2 peer-focus-visible:ring-[#9B30FF]/60"
        />
        <span
          aria-hidden="true"
          className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[#2A2A2A] pt-6 mt-6 first-of-type:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] mb-4">{title}</h2>
      {children}
    </section>
  )
}

function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="w-full px-5 py-3 rounded-full bg-[#9B30FF] text-white text-sm font-medium hover:bg-[#B560FF] transition-colors"
    >
      {children}
    </button>
  )
}

function SecondaryButton({
  children,
  name,
  value,
}: {
  children: React.ReactNode
  name?: string
  value?: string
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className="px-5 py-2.5 rounded-full border border-[#2A2A2A] text-[#D0D0D0] text-sm hover:text-white hover:border-[#9B30FF]/60 transition-colors"
    >
      {children}
    </button>
  )
}

function Notice({ tone, children }: { tone: 'ok' | 'warn'; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className={`text-sm rounded-xl px-4 py-3 mb-4 border ${
        tone === 'ok'
          ? 'text-[#D8B4FE] bg-[#9B30FF]/10 border-[#9B30FF]/30'
          : 'text-amber-300 bg-amber-500/10 border-amber-500/30'
      }`}
    >
      {children}
    </p>
  )
}

function Header({ error = false, title = 'Email preferences' }: { error?: boolean; title?: string }) {
  return (
    <div className="text-center">
      {error ? (
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/15 text-red-400 mb-5">
          <AlertCircle className="w-7 h-7" />
        </div>
      ) : (
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#9B30FF]/15 text-[#9B30FF] mb-5">
          <Mail className="w-7 h-7" />
        </div>
      )}
      <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
    </div>
  )
}

function Footer() {
  return (
    <div className="text-center mt-8">
      <Link
        href="/"
        className="inline-block px-5 py-2.5 rounded-full border border-[#2A2A2A] text-[#A0A0A0] text-sm hover:text-white hover:border-[#3A3A3A]"
      >
        Back to Untamed
      </Link>
    </div>
  )
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="max-w-lg w-full rounded-2xl border border-[#2A2A2A] bg-[#111] p-6 sm:p-8 my-8">
        {children}
      </div>
    </main>
  )
}
