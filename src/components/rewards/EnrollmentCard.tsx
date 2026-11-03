'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { US_STATES } from '@/lib/rewards/states'
import { engagementAllowed } from '@/lib/rewards/state-rules'
import { PROGRAM_NAME, PROGRAM_RULES_PATH } from '@/lib/rewards/program'
import type { IneligibleReason } from '@/lib/rewards/eligibility'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const HEADINGS: Partial<Record<IneligibleReason, { title: string; body: string }>> = {
  not_enrolled: {
    title: `Join ${PROGRAM_NAME}`,
    body: 'Confirm a few details to start earning points and get your share link. Pack Rewards is for adults 21+.',
  },
  rules_updated: {
    title: 'The Program Rules changed',
    body: 'Review and accept the updated rules to keep earning and redeeming.',
  },
  enrollment_expired: {
    title: 'Your yearly check-in',
    body: 'Once a year we ask members to re-confirm they are eligible. It takes a few seconds.',
  },
  state_not_eligible: {
    title: 'Pack Rewards isn’t offered in your state',
    body: 'The program is open in the states we ship to. If you live in one of them, confirm your details below.',
  },
}

const ATTESTATIONS = [
  {
    key: 'ofAge',
    label: 'I am 21 or older.',
  },
  {
    key: 'notTrade',
    label:
      'I do not own, work for, or represent an alcohol retailer, bar, restaurant, wholesaler, or distributor, and I am not an immediate family or household member of someone who does.',
  },
  {
    key: 'disclosesReferrals',
    label:
      'When I share Untamed, I will say I earn rewards from Untamed, and I will only share with people I know are 21 or older.',
  },
  {
    key: 'acceptsRules',
    label: 'I have read and agree to the Program Rules.',
  },
] as const

type AttestationKey = (typeof ATTESTATIONS)[number]['key']

interface Props {
  reason: IneligibleReason
  defaultState?: string | null
}

/**
 * The 21+ enrollment step for Pack Rewards: full date of birth, state of
 * residence, and the eligibility attestations. Shown wherever a member could
 * earn or redeem until they have enrolled on the current Program Rules.
 */
export function EnrollmentCard({ reason, defaultState }: Props) {
  const router = useRouter()
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) => thisYear - 21 - i + 1)

  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [year, setYear] = useState('')
  const [state, setState] = useState(engagementAllowed(defaultState) ? defaultState! : '')
  const [checked, setChecked] = useState<Record<AttestationKey, boolean>>({
    ofAge: false,
    notTrade: false,
    disclosesReferrals: false,
    acceptsRules: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const heading = HEADINGS[reason] ?? HEADINGS.not_enrolled!
  const allChecked = ATTESTATIONS.every((a) => checked[a.key])
  const complete = month && day && year && state && allChecked

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!complete) return
    setLoading(true)
    setError('')
    try {
      const birthdate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const res = await fetch('/api/portal/rewards/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthdate, residenceState: state, attestations: checked }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.message || 'Something went wrong. Please try again.')
        return
      }
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectCls =
    'bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#9B30FF] w-full'

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#141414] border border-[#9B30FF]/30 rounded-2xl p-6 space-y-5"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#9B30FF]/15 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-[#9B30FF]" />
        </div>
        <div>
          <h2 className="font-semibold text-white mb-1">{heading.title}</h2>
          <p className="text-sm text-[#A0A0A0]">{heading.body}</p>
        </div>
      </div>

      <fieldset>
        <legend className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
          Date of birth
        </legend>
        <div className="grid grid-cols-3 gap-2">
          <label className="sr-only" htmlFor="enroll-month">Month</label>
          <select id="enroll-month" value={month} onChange={(e) => setMonth(e.target.value)} className={selectCls} required>
            <option value="">Month</option>
            {MONTHS.map((name, i) => (
              <option key={name} value={String(i + 1)}>{name}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="enroll-day">Day</label>
          <select id="enroll-day" value={day} onChange={(e) => setDay(e.target.value)} className={selectCls} required>
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="enroll-year">Year</label>
          <select id="enroll-year" value={year} onChange={(e) => setYear(e.target.value)} className={selectCls} required>
            <option value="">Year</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <div>
        <label htmlFor="enroll-state" className="block text-xs font-semibold text-white uppercase tracking-wider mb-2">
          State you live in
        </label>
        <select id="enroll-state" value={state} onChange={(e) => setState(e.target.value)} className={selectCls} required>
          <option value="">Choose your state</option>
          {US_STATES.filter(([code]) => engagementAllowed(code)).map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
        <p className="text-xs text-[#A0A0A0] mt-2">
          Pack Rewards is open in the states we ship to. Not listed? We don&apos;t ship there yet.
          Some rewards depend on state law. Purchase points are only available in some states; see the{' '}
          <Link href={PROGRAM_RULES_PATH} target="_blank" className="text-[#9B30FF] underline">
            Program Rules
          </Link>
          .
        </p>
      </div>

      <div className="space-y-3">
        {ATTESTATIONS.map((a) => (
          <label key={a.key} className="flex items-start gap-3 text-sm text-[#D0D0D0] cursor-pointer">
            <input
              type="checkbox"
              checked={checked[a.key]}
              onChange={(e) => setChecked((prev) => ({ ...prev, [a.key]: e.target.checked }))}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#9B30FF]"
            />
            <span>
              {a.key === 'acceptsRules' ? (
                <>
                  I have read and agree to the{' '}
                  <Link href={PROGRAM_RULES_PATH} target="_blank" className="text-[#9B30FF] underline">
                    Program Rules
                  </Link>
                  .
                </>
              ) : (
                a.label
              )}
            </span>
          </label>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm border bg-red-500/10 border-red-500/30 text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!complete || loading}
        className="inline-flex items-center gap-2 bg-[#9B30FF] text-white text-sm font-semibold rounded-full px-5 py-2.5 hover:bg-[#7E22CE] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {reason === 'not_enrolled' ? 'Join Pack Rewards' : 'Confirm and continue'}
      </button>
    </form>
  )
}
