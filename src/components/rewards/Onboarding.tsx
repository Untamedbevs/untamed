'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2, PawPrint, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { artSrc } from '@/lib/rewards/art'
import { US_STATES } from '@/lib/rewards/states'
import { engagementAllowed } from '@/lib/rewards/state-rules'
import { PROGRAM_RULES_PATH } from '@/lib/rewards/program'
import { POINTS } from '@/lib/loyalty/constants'
import type { SpiritAnimal } from '@/lib/rewards/spirit-animals'
import { ATTESTATIONS, MONTHS } from './EnrollmentCard'
import { ClawMarks } from './ClawMarks'
import './rewards.css'

type AttestationKey = (typeof ATTESTATIONS)[number]['key']
const STEPS = ['Welcome', 'Spirit', 'Age', 'Code', 'Reveal'] as const

/**
 * Pack Rewards onboarding: a short, guided walk into the program. It ends in
 * the same 21+ enrollment as EnrollmentCard (birthdate, state, attestations)
 * and saves the member's spirit animal.
 */
export function Onboarding({
  firstName,
  defaultState,
  spirits,
  preview,
  readOnly,
}: {
  firstName: string | null
  defaultState: string | null
  spirits: SpiritAnimal[]
  /** A few milestones to tease on the welcome step. */
  preview: { icon: string | null; title: string; points: number }[]
  /** View As: walk through the steps, but don't submit. */
  readOnly?: boolean
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [spirit, setSpirit] = useState<SpiritAnimal | null>(null)
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
  const [bonus, setBonus] = useState(0)

  const accent = spirit?.color ?? '#9B30FF'
  const ageDone = month && day && year && state
  const codeDone = ATTESTATIONS.every((a) => checked[a.key])

  async function join() {
    if (readOnly) {
      setError('View As is read-only, so this stops before enrolling.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/portal/rewards/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthdate: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
          residenceState: state,
          attestations: checked,
          spiritAnimal: spirit?.slug,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.message || 'Something went wrong. Please try again.')
        return
      }
      setBonus(body.bonusGranted ?? 0)
      setStep(4)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const select =
    'w-full rounded-xl border border-[#2A2A2A] bg-black/50 px-3 py-3 text-sm text-white focus:border-[#9B30FF] focus:outline-none'

  return (
    <section
      className="relative overflow-hidden rounded-[32px] border border-[#2A2A2A] bg-[#0D0D0D]"
      style={{ ['--rw-glow' as string]: `${accent}66` }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url('/images/referral-hq/map.jpg')] bg-cover bg-center opacity-[0.16]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-colors duration-700"
        style={{ background: `radial-gradient(90% 80% at 50% 0%, ${accent}2E 0%, #0D0D0Dee 55%, #0D0D0D 100%)` }}
      />
      <ClawMarks className="pointer-events-none absolute -right-10 top-6 h-64 w-64 text-white opacity-[0.04]" />

      <div className="relative px-5 pb-6 pt-5 sm:px-10 sm:pb-10 sm:pt-8">
        {/* Paw-print progress */}
        <div className="flex items-center justify-center gap-2" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <PawPrint
              key={s}
              className={cn('h-4 w-4 transition-opacity duration-500', i > step && 'opacity-25')}
              style={{ color: i <= step ? accent : '#888', transform: `rotate(${i % 2 ? 12 : -12}deg)` }}
            />
          ))}
        </div>

        <div key={step} className="rw-rise mx-auto mt-6 max-w-2xl">
          {step === 0 && (
            <div className="text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#A0A0A0]">Untamed Pack Rewards</div>
              <h2 className="mt-2 font-wild cyber-brush-fix text-5xl leading-none text-white sm:text-6xl">
                {firstName ? `${firstName}, your trail starts here` : 'Your trail starts here'}
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-[#C8C8C8]">
                Earn points for joining, bringing friends, sharing your moments and completing Hunts. Every milestone on
                your trail unlocks a reward.
              </p>
              <div className="mt-8 flex items-end justify-center gap-3 sm:gap-6">
                {preview.map((m, i) => (
                  <div key={m.title} className="flex w-24 flex-col items-center sm:w-28" style={{ animationDelay: `${i * 0.4}s` }}>
                    <Image
                      src={artSrc(m.icon)}
                      alt=""
                      width={96}
                      height={96}
                      className={cn('rw-float', i === 1 && 'scale-110')}
                      style={{ animationDelay: `${i * 0.6}s` }}
                    />
                    <div className="mt-2 text-xs font-semibold text-white">{m.title}</div>
                    <div className="text-[11px] text-[#A0A0A0]">{m.points.toLocaleString('en-US')} pts</div>
                  </div>
                ))}
              </div>
              <PrimaryButton onClick={() => setStep(1)} accent={accent} className="mt-8">
                Let’s go <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
              <p className="mt-3 text-xs text-[#777]">Takes about a minute. Adults 21+ only.</p>
            </div>
          )}

          {step === 1 && (
            <div>
              <StepHeading kicker="Step 1 of 3" title="Choose your spirit animal">
                Every Untamed cat has a personality. Pick the one that runs with you. It themes your Pack Pass.
              </StepHeading>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {spirits.map((s) => {
                  const active = spirit?.slug === s.slug
                  return (
                    <button
                      key={s.slug}
                      type="button"
                      onClick={() => setSpirit(s)}
                      aria-pressed={active}
                      className={cn(
                        'group relative flex flex-col items-center rounded-2xl border bg-black/40 p-3 text-center transition-all duration-300',
                        active ? 'scale-[1.03]' : 'border-[#2A2A2A] hover:border-[#444]'
                      )}
                      style={active ? { borderColor: s.color, boxShadow: `0 0 0 1px ${s.color}, 0 12px 40px -12px ${s.colorGlow}` } : undefined}
                    >
                      <Image
                        src={s.art}
                        alt=""
                        width={88}
                        height={88}
                        className={cn('transition-transform duration-300', active ? 'rw-pop' : 'group-hover:scale-105')}
                      />
                      <div className="mt-2 font-headline text-lg uppercase" style={{ color: active ? s.color : '#fff' }}>
                        {s.name}
                      </div>
                      <div className="mt-1 text-[11px] leading-snug text-[#A0A0A0]">{s.tagline}</div>
                      {active && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: s.color }}>
                          <Check className="h-3 w-3 text-black" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <StepNav
                onBack={() => setStep(0)}
                onNext={() => setStep(2)}
                nextLabel={spirit ? `I’m a ${spirit.name}` : 'Choose one'}
                disabled={!spirit}
                accent={accent}
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <StepHeading kicker="Step 2 of 3" title="Prove you’re 21+">
                Pack Rewards is for adults 21 and older in the states we ship to. We ask for your full birthdate once.
              </StepHeading>
              <div className="mt-6 grid grid-cols-3 gap-2">
                <select value={month} onChange={(e) => setMonth(e.target.value)} className={select} aria-label="Birth month">
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={String(i + 1)}>
                      {m}
                    </option>
                  ))}
                </select>
                <select value={day} onChange={(e) => setDay(e.target.value)} className={select} aria-label="Birth day">
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>
                      {i + 1}
                    </option>
                  ))}
                </select>
                <select value={year} onChange={(e) => setYear(e.target.value)} className={select} aria-label="Birth year">
                  <option value="">Year</option>
                  {years.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <select value={state} onChange={(e) => setState(e.target.value)} className={cn(select, 'mt-2')} aria-label="State you live in">
                <option value="">State you live in</option>
                {US_STATES.filter(([code]) => engagementAllowed(code)).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
              <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Continue" disabled={!ageDone} accent={accent} />
            </div>
          )}

          {step === 3 && (
            <div>
              <StepHeading kicker="Step 3 of 3" title="The Pack Code">
                Four promises every member makes. Tap each one to take it.
              </StepHeading>
              <div className="mt-6 space-y-2">
                {ATTESTATIONS.map((a) => {
                  const on = checked[a.key]
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => setChecked((c) => ({ ...c, [a.key]: !c[a.key] }))}
                      aria-pressed={on}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-2xl border bg-black/40 p-4 text-left text-sm transition-colors',
                        on ? 'text-white' : 'border-[#2A2A2A] text-[#C8C8C8] hover:border-[#444]'
                      )}
                      style={on ? { borderColor: `${accent}AA`, background: `${accent}14` } : undefined}
                    >
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors"
                        style={on ? { background: accent, borderColor: accent } : { borderColor: '#444' }}
                      >
                        {on && <Check className="h-3.5 w-3.5 text-black" />}
                      </span>
                      <span>
                        {a.key === 'acceptsRules' ? (
                          <>
                            I have read and agree to the{' '}
                            <Link href={PROGRAM_RULES_PATH} target="_blank" className="underline" onClick={(e) => e.stopPropagation()}>
                              Program Rules
                            </Link>
                            .
                          </>
                        ) : (
                          a.label
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
              {error && (
                <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}
              <StepNav
                onBack={() => setStep(2)}
                onNext={join}
                nextLabel={
                  loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" /> Join the pack
                    </>
                  )
                }
                disabled={!codeDone || loading}
                accent={accent}
              />
            </div>
          )}

          {step === 4 && (
            <div className="text-center">
              <div className="relative mx-auto h-48 w-48">
                <div
                  className="rw-burst absolute inset-0 rounded-full"
                  style={{ background: `repeating-conic-gradient(${accent}66 0deg 8deg, transparent 8deg 24deg)` }}
                />
                <ClawMarks animate className="absolute -left-2 top-2 h-44 w-44 text-[#FFD700]/80" />
                <Image src={spirit?.art ?? artSrc('first-tracks')} alt="" fill sizes="192px" className="rw-pop object-contain p-6" />
              </div>
              <h2 className="mt-2 font-wild cyber-brush-fix text-5xl leading-none text-white">Welcome to the pack</h2>
              {bonus > 0 && (
                <p className="mt-3 text-lg">
                  <span className="font-semibold text-[#FFD700]">+{bonus.toLocaleString('en-US')} points</span>{' '}
                  <span className="text-[#C8C8C8]">just hit your trail.</span>
                </p>
              )}
              <p className="mx-auto mt-2 max-w-md text-sm text-[#A0A0A0]">
                Your first milestone is {preview[0]?.title ?? 'close'}. Complete a Hunt or bring a friend to get there fast.
              </p>
              <PrimaryButton onClick={() => router.refresh()} accent={accent} className="mt-6">
                Enter your HQ <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
            </div>
          )}
        </div>
        {step < 4 && <p className="mt-6 text-center text-[11px] text-[#666]">Joining gives you {POINTS.SIGNUP_BONUS.toLocaleString('en-US')} points to start.</p>}
      </div>
    </section>
  )
}

function StepHeading({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#A0A0A0]">{kicker}</div>
      <h2 className="mt-1 font-headline text-3xl uppercase text-white sm:text-4xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-[#C8C8C8]">{children}</p>
    </div>
  )
}

function StepNav({
  onBack,
  onNext,
  nextLabel,
  disabled,
  accent,
}: {
  onBack: () => void
  onNext: () => void
  nextLabel: React.ReactNode
  disabled: boolean
  accent: string
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-[#A0A0A0] hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <PrimaryButton onClick={onNext} disabled={disabled} accent={accent}>
        {nextLabel}
      </PrimaryButton>
    </div>
  )
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  accent,
  className,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  accent: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex min-w-[10rem] items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40',
        className
      )}
      style={{ background: disabled ? '#555' : `linear-gradient(90deg, ${accent}, #FFD700)` }}
    >
      {children}
    </button>
  )
}
