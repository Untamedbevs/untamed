'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { drinks, type Drink } from '@/lib/drinks'

export const CANS_GROUP = '/brand-kit/cans/cans-group-front.png'

export type SlideTheme = {
  accent: string
  animal: string
  scratch?: string
}

export function spiritAt(index: number): Drink {
  return drinks[index % drinks.length]
}

export function SlideFrame({
  section,
  title,
  intro,
  children,
  footnote,
  hideAnimal = false,
  theme,
}: {
  section: string
  title: ReactNode
  intro?: ReactNode
  children: ReactNode
  footnote?: string
  hideAnimal?: boolean
  theme: SlideTheme
}) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden px-6 pb-16 pt-14 sm:px-10 md:px-16 lg:px-24">
      {theme.scratch && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: `url(${theme.scratch})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      <div
        className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full opacity-[0.18] blur-[140px]"
        style={{ backgroundColor: theme.accent }}
      />
      {!hideAnimal && (
        <div className="pointer-events-none absolute -right-16 bottom-0 top-0 flex items-center opacity-[0.10] md:-right-8">
          <Image
            src={theme.animal}
            alt=""
            width={700}
            height={700}
            className="h-[70vh] w-auto max-w-none select-none"
          />
        </div>
      )}
      <div className="relative z-10 mx-auto my-auto w-full max-w-6xl">
        <div className="flex items-center gap-3">
          <span
            className="h-[2px] w-10 rounded-full"
            style={{ background: `linear-gradient(90deg, ${theme.accent}, transparent)` }}
          />
          <p
            className="font-condensed text-xs font-bold uppercase tracking-[0.35em] md:text-sm"
            style={{ color: theme.accent }}
          >
            {section.replace(/([A-Z])/g, ' $1').trim()}
          </p>
        </div>
        <h2 className="animate-scratch mt-2 font-condensed text-3xl font-bold uppercase leading-[1.02] tracking-tight sm:text-4xl md:text-5xl">
          {title}
        </h2>
        {intro && (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-untamed-white-muted md:text-base">
            {intro}
          </p>
        )}
        <div className="mt-6 md:mt-7">{children}</div>
        {footnote && <p className="mt-5 text-[11px] leading-relaxed text-muted md:text-xs">{footnote}</p>}
      </div>
    </div>
  )
}

export function SpiritCard({
  drink,
  color,
  glow,
  children,
  className = '',
}: {
  drink?: Drink
  color?: string
  glow?: string
  children: ReactNode
  className?: string
}) {
  const border = drink?.colorLight ?? color ?? '#FFD700'
  const shadow = drink?.colorGlow ?? glow
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-untamed-black-card/80 p-5 backdrop-blur-sm ${className}`}
      style={{
        borderColor: `${border}55`,
        boxShadow: shadow ? `0 0 50px -18px ${shadow}` : undefined,
      }}
    >
      {children}
    </div>
  )
}

export function CanHero({
  drink,
  className = '',
  size = 'md',
}: {
  drink: Drink
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.16]">
        <Image
          src={drink.animalImage}
          alt=""
          width={340}
          height={340}
          className="h-full w-auto max-w-none select-none"
        />
      </div>
      <Image
        src={drink.canImage}
        alt={`${drink.name} — ${drink.flavor}`}
        width={220}
        height={380}
        className={`relative mx-auto w-auto drop-shadow-xl ${size === 'sm' ? 'h-16 md:h-20' : 'h-40 md:h-52'}`}
      />
    </div>
  )
}

export function LineupGrid({ tagline }: { tagline?: string }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        {drinks.map((d) => (
          <div
            key={d.slug}
            className="relative flex flex-col items-center overflow-hidden rounded-2xl border bg-untamed-black-card/80 p-4 text-center backdrop-blur-sm md:p-5"
            style={{ borderColor: `${d.colorLight}44`, boxShadow: `0 0 50px -18px ${d.colorGlow}` }}
          >
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.12]">
              <Image
                src={d.animalImage}
                alt=""
                width={340}
                height={340}
                className="h-full w-auto max-w-none select-none"
              />
            </div>
            <Image
              src={d.canImage}
              alt={`${d.name} — ${d.flavor}`}
              width={200}
              height={340}
              className="relative h-32 w-auto drop-shadow-xl md:h-44"
            />
            <p className="cyber-brush-fix relative mt-3 font-wild text-xl md:text-2xl" style={{ color: d.colorLight }}>
              {d.name}
            </p>
            <p className="relative mt-1 font-condensed text-xs font-bold uppercase tracking-widest text-untamed-white md:text-sm">
              {d.flavor}
            </p>
            <p className="relative mt-2 hidden text-xs leading-relaxed text-untamed-white-muted lg:block">
              {d.tagline}
            </p>
          </div>
        ))}
      </div>
      {tagline && <p className="mt-6 text-sm text-untamed-white-muted md:text-base">{tagline}</p>}
    </>
  )
}

export function WildLine({
  children,
  className = 'text-3xl md:text-5xl',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={`cyber-brush-fix font-wild text-gradient-wild ${className}`}>{children}</p>
  )
}

export function CansStrip({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center ${className}`}>
      <Image
        src={CANS_GROUP}
        alt="Untamed martini can lineup"
        width={1400}
        height={640}
        className="h-auto w-[68%] max-w-2xl translate-y-[22%] select-none md:max-w-3xl"
        style={{
          maskImage: 'linear-gradient(to bottom, black 55%, transparent 96%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 96%)',
        }}
        priority
      />
    </div>
  )
}

export function DeckCover({
  scratch,
  eyebrow,
  line,
  sub,
  footer,
  lineVariant = 'wild',
}: {
  scratch: string
  eyebrow: string
  line?: string
  sub?: string
  footer?: string
  lineVariant?: 'wild' | 'condensed'
}) {
  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-hidden px-6 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage: `url(${scratch})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-[#9B30FF] opacity-[0.18] blur-[130px]" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-[420px] w-[420px] rounded-full bg-[#FF8C2A] opacity-[0.14] blur-[130px]" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center pb-[30vh]">
        <Image
          src="/images/logo-mark.png"
          alt="Untamed Beverages logo"
          width={120}
          height={120}
          className="h-16 w-16 md:h-20 md:w-20"
          priority
        />
        <h1 className="mt-3 font-headline text-5xl uppercase tracking-wide sm:text-6xl md:text-7xl">
          Untamed
        </h1>
        <p className="mt-2 font-condensed text-sm font-bold uppercase tracking-[0.3em] text-untamed-silver md:text-lg">
          {eyebrow}
        </p>
        {line &&
          (lineVariant === 'wild' ? (
            <WildLine className="mt-6 max-w-3xl text-3xl leading-tight md:text-5xl">{line}</WildLine>
          ) : (
            <p className="mt-6 max-w-3xl font-condensed text-2xl font-bold uppercase leading-tight md:text-4xl">
              {line}
            </p>
          ))}
        {sub && <p className="mt-4 max-w-xl text-sm text-untamed-white md:text-base">{sub}</p>}
        {footer && (
          <p className="mt-6 font-condensed text-[11px] uppercase tracking-[0.3em] text-muted md:text-xs">
            {footer}
          </p>
        )}
      </div>
      <CansStrip />
    </div>
  )
}
