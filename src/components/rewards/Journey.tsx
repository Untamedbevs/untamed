'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Crosshair,
  Loader2,
  PawPrint,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { artSrc } from '@/lib/rewards/art'
import { US_STATES } from '@/lib/rewards/states'
import { engagementAllowed } from '@/lib/rewards/state-rules'
import { PROGRAM_RULES_PATH } from '@/lib/rewards/program'
import type { SpiritAnimal } from '@/lib/rewards/spirit-animals'
import { ATTESTATIONS, MONTHS } from './EnrollmentCard'
import { ClawSlash, Embers, Gate, fitName, useCountUp } from './pack-fx'
import './portal.css'

type AttestationKey = (typeof ATTESTATIONS)[number]['key']
const SCENES = ['Gate', 'Spirit', 'Trail', 'Age', 'Code', 'Reveal'] as const
const GATE_BACKDROP = '/images/portal/journey-gate.webp'

/**
 * Pack Rewards onboarding as its own full-screen journey: no portal chrome,
 * one scene at a time over cinematic backdrops, ending in the same 21+
 * enrollment as EnrollmentCard. The dashboard only appears at the end, when
 * the gate doors close and reopen onto it (see DashboardIntro).
 */
export function Journey({
  firstName,
  defaultState,
  startingPoints,
  spirits,
  preview,
  readOnly,
}: {
  firstName: string | null
  defaultState: string | null
  /** Points already on the account (the signup bonus), shown at the reveal. */
  startingPoints: number
  spirits: SpiritAnimal[]
  /** A few milestones to show on the trail scene. */
  preview: { icon: string | null; title: string; points: number; tagline?: string | null }[]
  /** View As: walk through the scenes, but don't enroll. */
  readOnly?: boolean
}) {
  const [scene, setScene] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [slash, setSlash] = useState(0)
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
  const [points, setPoints] = useState(startingPoints)
  const [closing, setClosing] = useState(false)

  const accent = spirit?.color ?? '#9B30FF'
  const ageDone = month && day && year && state
  const codeDone = ATTESTATIONS.every((a) => checked[a.key])
  const backdrop = scene >= 1 && spirit ? spirit.habitat : GATE_BACKDROP

  function go(next: number) {
    setDirection(next > scene ? 'forward' : 'backward')
    if (next > scene) setSlash((n) => n + 1)
    setError('')
    setScene(next)
    window.scrollTo({ top: 0 })
  }

  async function join() {
    if (readOnly) {
      go(5)
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
      setPoints(startingPoints + (body.bonusGranted ?? 0))
      go(5)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function exitViewAs() {
    const res = await fetch('/api/admin/view-as', { method: 'DELETE' }).catch(() => null)
    const data = await res?.json().catch(() => null)
    window.location.href = data?.redirectTo || '/admin/view-as'
  }

  async function openHq() {
    // In View As the member isn't enrolled, so there's no HQ to open: end the preview.
    if (readOnly) return exitViewAs()
    setClosing(true)
    // The doors close here; the dashboard loads behind closed doors and opens them.
    setTimeout(() => {
      window.location.href = '/portal?opened=1'
    }, 1350)
  }

  const field =
    'w-full appearance-none rounded-2xl border border-white/15 bg-black/55 px-4 py-4 text-base text-white backdrop-blur-md transition-colors focus:border-[var(--pk-accent)] focus:outline-none'

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden bg-black text-white"
      style={{ ['--pk-accent' as string]: accent }}
    >
      {/* Backdrops cross-fade as the member picks a spirit animal. */}
      {[GATE_BACKDROP, ...spirits.map((s) => s.habitat)].map((src) => (
        <div key={src} aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          <Image
            src={src}
            alt=""
            fill
            priority={src === GATE_BACKDROP}
            sizes="100vw"
            className={cn('pk-backdrop object-cover', backdrop === src ? 'opacity-100' : 'opacity-0')}
          />
        </div>
      ))}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 transition-[background] duration-1000"
        style={{
          background: `radial-gradient(120% 80% at 50% 100%, #000 15%, transparent 70%), linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25) 35%, rgba(0,0,0,0.85)), radial-gradient(60% 50% at 50% 40%, ${accent}22, transparent 70%)`,
        }}
      />
      <Embers />
      <div className="pk-grain" />
      {slash > 0 && scene < 5 && <ClawSlash key={slash} color={scene >= 1 && spirit ? spirit.color : '#FFD700'} />}

      {/* Top bar: back, paw-print progress, step count. */}
      <header className="relative z-20 mx-auto flex max-w-5xl items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
        <button
          type="button"
          onClick={() => go(scene - 1)}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur transition-opacity hover:bg-white/10',
            (scene === 0 || scene === 5) && 'pointer-events-none opacity-0'
          )}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2" aria-label={`Step ${scene + 1} of ${SCENES.length}`}>
          {SCENES.map((s, i) => (
            <span key={s} className="relative flex h-6 w-6 items-center justify-center">
              <PawPrint
                className={cn('h-4 w-4 transition-all duration-700', i > scene && 'opacity-25', i === scene && 'scale-125')}
                style={{ color: i <= scene ? accent : '#888', transform: `rotate(${i % 2 ? 14 : -14}deg)` }}
              />
            </span>
          ))}
        </div>
        <div className="w-10 text-right text-[11px] font-semibold tabular-nums text-white/50">
          {scene + 1}/{SCENES.length}
        </div>
      </header>

      {readOnly && (
        <div className="relative z-20 mx-auto mt-3 flex w-fit items-center gap-3 rounded-full border border-[#FFD700]/40 bg-black/60 py-1 pl-4 pr-1 text-xs text-[#FFE680] backdrop-blur">
          View As preview · nothing here is saved
          <button
            type="button"
            onClick={exitViewAs}
            className="rounded-full border border-[#FFD700]/40 px-3 py-1 font-semibold text-white transition-colors hover:bg-[#FFD700]/15"
          >
            Exit View As
          </button>
        </div>
      )}

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-5rem)] max-w-5xl flex-col justify-center px-5 pb-10 pt-6 sm:px-8">
        <div key={scene} className={direction === 'forward' ? 'pk-scene-forward' : 'pk-scene-backward'}>
          {scene === 0 && (
            <div className="mx-auto max-w-2xl text-center">
              <div style={{ ['--i' as string]: 0 }} className="mx-auto mb-6 h-20 w-20">
                <div className="relative h-full w-full">
                  <div className="pk-ring absolute inset-0 rounded-full blur-md" />
                  <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-black/80">
                    <Image src="/images/logo-mark.png" alt="" width={48} height={48} className="object-contain" />
                  </div>
                </div>
              </div>
              <p style={{ ['--i' as string]: 1 }} className="text-xs font-semibold uppercase tracking-[0.45em] text-[#FFD700]">
                Untamed Pack Rewards
              </p>
              <h1 style={{ ['--i' as string]: 2 }} className="mt-4 max-w-full font-wild cyber-brush-fix text-6xl leading-[0.95] sm:text-8xl">
                <span className={cn('[overflow-wrap:anywhere]', fitName(firstName, ['', 'text-5xl sm:text-7xl', 'text-4xl sm:text-6xl']))}>
                  {firstName ? `${firstName},` : 'Hey,'}
                </span>
                <br />
                <span className="pk-gradient-text">the wild is calling</span>
              </h1>
              <p style={{ ['--i' as string]: 3 }} className="mx-auto mt-6 max-w-md text-base text-white/75 sm:text-lg">
                A minute from now you&apos;ll have a spirit animal, a trail of rewards, and a pack to run with.
              </p>
              <div style={{ ['--i' as string]: 4 }} className="mt-10">
                <GlowButton onClick={() => go(1)} accent="#9B30FF">
                  Step through the gate <ArrowRight className="h-5 w-5" />
                </GlowButton>
              </div>
              <p style={{ ['--i' as string]: 5 }} className="mt-4 text-xs text-white/45">
                For adults 21+ only ·{' '}
                <Link href="/" className="underline underline-offset-2 hover:text-white">
                  Not now
                </Link>
              </p>
            </div>
          )}

          {scene === 1 && (
            <div>
              <SceneTitle kicker="Chapter 1 · Your spirit" title="Who runs with you?">
                Four Untamed cats. One is yours. It themes your pass, your trail and your HQ.
              </SceneTitle>
              <div
                style={{ ['--i' as string]: 3 }}
                className="pk-snap -mx-5 mt-8 flex gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0"
              >
                {spirits.map((s) => {
                  const active = spirit?.slug === s.slug
                  return (
                    <button
                      key={s.slug}
                      type="button"
                      onClick={() => setSpirit(s)}
                      aria-pressed={active}
                      className={cn(
                        'group relative flex h-[22rem] w-[72vw] max-w-[18rem] shrink-0 flex-col justify-end overflow-hidden rounded-[28px] border text-left transition-all duration-500 sm:h-[24rem] sm:w-auto sm:max-w-none',
                        active ? 'scale-[1.03] border-transparent' : 'border-white/10 hover:-translate-y-1 hover:border-white/30'
                      )}
                      style={
                        active
                          ? { boxShadow: `0 0 0 2px ${s.color}, 0 30px 80px -20px ${s.colorGlow}, 0 0 60px -10px ${s.color}` }
                          : undefined
                      }
                    >
                      <Image src={s.habitat} alt="" fill sizes="(min-width: 640px) 25vw, 72vw" className="object-cover opacity-70 transition-transform duration-700 group-hover:scale-110" />
                      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 20%, ${s.color}33 55%, #000 92%)` }} />
                      <Image
                        src={s.portrait}
                        alt=""
                        width={260}
                        height={388}
                        className={cn(
                          'absolute left-1/2 top-3 h-[68%] w-auto -translate-x-1/2 object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.8)] transition-transform duration-700',
                          active ? 'scale-110' : 'group-hover:scale-105'
                        )}
                      />
                      <div className="relative p-5">
                        <div className="font-headline text-3xl uppercase leading-none" style={{ color: active ? s.color : '#fff' }}>
                          {s.name}
                        </div>
                        <div className="mt-2 text-xs leading-snug text-white/75">{s.tagline}</div>
                      </div>
                      {active && (
                        <span className="rw-pop absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full" style={{ background: s.color }}>
                          <Check className="h-4 w-4 text-black" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <SceneNav onNext={() => go(2)} disabled={!spirit} accent={accent}>
                {spirit ? `I run with the ${spirit.name}` : 'Choose your cat'}
              </SceneNav>
            </div>
          )}

          {scene === 2 && (
            <div>
              <SceneTitle kicker="Chapter 2 · Your trail" title="Every move leaves a mark">
                Points stack up along your trail. Every milestone you pass unlocks a reward.
              </SceneTitle>
              <div style={{ ['--i' as string]: 3 }} className="relative mx-auto mt-10 max-w-3xl">
                <div className="absolute left-8 right-8 top-12 hidden h-1 rounded-full bg-white/10 sm:block">
                  <div className="h-full w-2/3 rounded-full" style={{ background: `linear-gradient(90deg, ${accent}, #FFD700)` }} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {preview.map((m, i) => (
                    <div key={m.title} className="relative flex flex-col items-center text-center">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full blur-2xl" style={{ background: `${i === 2 ? '#FFD700' : accent}55` }} />
                        <Image src={artSrc(m.icon)} alt="" width={104} height={104} className="rw-float relative" style={{ animationDelay: `${i * 0.5}s` }} />
                      </div>
                      <div className="mt-3 font-headline text-lg uppercase leading-tight">{m.title}</div>
                      <div className="text-xs font-semibold text-[#FFD700]">{m.points.toLocaleString('en-US')} pts</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ ['--i' as string]: 4 }} className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { Icon: Sparkles, title: 'Join', body: 'Points the moment you’re in' },
                  { Icon: Crosshair, title: 'Hunts', body: 'Missions with big point drops' },
                  { Icon: Users, title: 'Your pack', body: 'Friends 21+ who join with your link' },
                  { Icon: Camera, title: 'Moments', body: 'Share how you drink Untamed' },
                ].map(({ Icon, title, body }) => (
                  <div key={title} className="pk-glass p-4">
                    <Icon className="h-5 w-5" style={{ color: accent }} />
                    <div className="mt-3 text-sm font-semibold">{title}</div>
                    <div className="mt-1 text-xs leading-snug text-white/60">{body}</div>
                  </div>
                ))}
              </div>
              <SceneNav onNext={() => go(3)} accent={accent}>
                Show me how to join
              </SceneNav>
            </div>
          )}

          {scene === 3 && (
            <div className="mx-auto max-w-xl">
              <SceneTitle kicker="Chapter 3 · The checkpoint" title="21+ beyond this point">
                Pack Rewards is for adults 21 and older in the states we ship to. We ask once.
              </SceneTitle>
              <div style={{ ['--i' as string]: 3 }} className="pk-glass mt-8 p-5 sm:p-6">
                <label className="text-xs font-semibold uppercase tracking-widest text-white/60">Your birthday</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <select value={month} onChange={(e) => setMonth(e.target.value)} className={field} aria-label="Birth month">
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={String(i + 1)}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select value={day} onChange={(e) => setDay(e.target.value)} className={field} aria-label="Birth day">
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                  <select value={year} onChange={(e) => setYear(e.target.value)} className={field} aria-label="Birth year">
                    <option value="">Year</option>
                    {years.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="mt-5 block text-xs font-semibold uppercase tracking-widest text-white/60">Where you live</label>
                <select value={state} onChange={(e) => setState(e.target.value)} className={cn(field, 'mt-2')} aria-label="State you live in">
                  <option value="">Choose your state</option>
                  {US_STATES.filter(([code]) => engagementAllowed(code)).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <SceneNav onNext={() => go(4)} disabled={!ageDone} accent={accent}>
                That&apos;s me
              </SceneNav>
            </div>
          )}

          {scene === 4 && (
            <div className="mx-auto max-w-2xl">
              <SceneTitle kicker="Chapter 4 · The Pack Code" title="Take the oath">
                Four promises every member makes. Tap each one to leave your mark.
              </SceneTitle>
              <div style={{ ['--i' as string]: 3 }} className="mt-8 space-y-3">
                {ATTESTATIONS.map((a, i) => {
                  const on = checked[a.key]
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => setChecked((c) => ({ ...c, [a.key]: !c[a.key] }))}
                      aria-pressed={on}
                      className={cn(
                        'pk-glass flex w-full items-center gap-4 p-4 text-left text-sm transition-all duration-300 sm:p-5',
                        on ? 'translate-x-1 text-white' : 'text-white/75 hover:text-white'
                      )}
                      style={on ? { background: `linear-gradient(100deg, ${accent}40, rgba(0,0,0,0.4) 70%)` } : undefined}
                    >
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-headline text-lg transition-all duration-300',
                          on && 'rw-pop'
                        )}
                        style={on ? { background: accent, borderColor: accent, color: '#000' } : { borderColor: 'rgba(255,255,255,0.25)' }}
                      >
                        {on ? <Check className="h-5 w-5" /> : i + 1}
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
                <p className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-300 backdrop-blur">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}
              <SceneNav onNext={join} disabled={!codeDone || loading} accent={accent}>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5" /> {readOnly ? 'Preview the reveal' : 'Join the pack'}
                  </>
                )}
              </SceneNav>
            </div>
          )}

          {scene === 5 && <Reveal spirit={spirit} points={points} firstName={firstName} readOnly={readOnly} onOpen={openHq} />}
        </div>
      </main>

      {closing && <ClosingGate accent={accent} />}
    </div>
  )
}

function Reveal({
  spirit,
  points,
  firstName,
  readOnly,
  onOpen,
}: {
  spirit: SpiritAnimal | null
  points: number
  firstName: string | null
  readOnly?: boolean
  onOpen: () => void
}) {
  const accent = spirit?.color ?? '#9B30FF'
  const shown = useCountUp(points, true, 1800)
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div style={{ ['--i' as string]: 0 }} className="relative mx-auto h-72 w-72 sm:h-80 sm:w-80">
        <div
          className="rw-burst absolute inset-[-30%] rounded-full"
          style={{ background: `repeating-conic-gradient(${accent}55 0deg 6deg, transparent 6deg 18deg)` }}
        />
        <div className="absolute inset-6 rounded-full blur-3xl" style={{ background: `${accent}66` }} />
        {spirit && (
          <>
            <Image src={spirit.portrait} alt="" width={300} height={447} className="rw-pop absolute left-1/2 top-0 h-full w-auto -translate-x-[70%] object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.9)]" />
            <Image
              src={spirit.can}
              alt=""
              width={110}
              height={288}
              className="pk-bob absolute bottom-2 right-6 h-[62%] w-auto object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.9)]"
            />
          </>
        )}
      </div>
      <p style={{ ['--i' as string]: 1 }} className="mt-4 text-xs font-semibold uppercase tracking-[0.45em]" >
        <span style={{ color: accent }}>{spirit ? `${spirit.name} pack` : 'The pack'}</span>
      </p>
      <h2
        style={{ ['--i' as string]: 2 }}
        className={cn('mt-3 max-w-full font-wild cyber-brush-fix leading-[0.95]', fitName(firstName, ['text-6xl sm:text-7xl', 'text-5xl sm:text-6xl', 'text-4xl sm:text-5xl']))}
      >
        <span className="pk-gradient-text">{firstName ? `Welcome, ${firstName}` : 'Welcome to the pack'}</span>
      </h2>
      <div style={{ ['--i' as string]: 3 }} className="mt-6 inline-flex items-baseline gap-2 rounded-full border border-white/15 bg-black/50 px-6 py-3 backdrop-blur">
        <span className="font-headline text-4xl tabular-nums text-[#FFD700]">{shown.toLocaleString('en-US')}</span>
        <span className="text-sm text-white/70">points on your trail</span>
      </div>
      {readOnly && <p className="mt-4 text-xs text-[#FFE680]">View As preview: this member is not enrolled, so nothing was saved.</p>}
      <div style={{ ['--i' as string]: 4 }} className="mt-10">
        <GlowButton onClick={onOpen} accent={accent}>
          {readOnly ? 'Exit preview' : 'Open my HQ'} <ArrowRight className="h-5 w-5" />
        </GlowButton>
      </div>
    </div>
  )
}

/** Doors slide shut from both sides before the dashboard loads. */
function ClosingGate({ accent }: { accent: string }) {
  const [shut, setShut] = useState(false)
  // Mount open, then close on the next frame so the transition runs.
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setShut(true))
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  return <Gate open={!shut} accent={accent} label="Opening your HQ" />
}

function SceneTitle({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <div style={{ ['--i' as string]: 0 }} className="text-[11px] font-semibold uppercase tracking-[0.4em]" >
        <span style={{ color: 'var(--pk-accent)' }}>{kicker}</span>
      </div>
      <h2 style={{ ['--i' as string]: 1 }} className="mt-3 font-headline text-4xl uppercase leading-none sm:text-6xl">
        {title}
      </h2>
      <p style={{ ['--i' as string]: 2 }} className="mx-auto mt-4 max-w-lg text-sm text-white/70 sm:text-base">
        {children}
      </p>
    </div>
  )
}

function SceneNav({
  onNext,
  disabled,
  accent,
  children,
}: {
  onNext: () => void
  disabled?: boolean
  accent: string
  children: React.ReactNode
}) {
  return (
    <div style={{ ['--i' as string]: 5 }} className="sticky bottom-4 z-20 mt-10 flex justify-center">
      <GlowButton onClick={onNext} disabled={disabled} accent={accent}>
        {children}
      </GlowButton>
    </div>
  )
}

function GlowButton({
  children,
  onClick,
  disabled,
  accent,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  accent: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative inline-flex min-h-14 min-w-[15rem] items-center justify-center gap-2 overflow-hidden rounded-full px-8 text-base font-bold text-black transition-all duration-300 hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
      style={{
        background: disabled ? '#555' : `linear-gradient(100deg, ${accent}, #FFD700 60%, #FFA500)`,
        boxShadow: disabled ? 'none' : `0 20px 50px -15px ${accent}, 0 0 30px -5px #FFD70088`,
      }}
    >
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </button>
  )
}
