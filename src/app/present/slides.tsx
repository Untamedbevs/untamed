'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { drinks } from '@/lib/drinks'
import { ONE_TWO_THREE, WHY_DIFFERENT } from '@/lib/retail/sell'
import {
  CanHero,
  DeckCover,
  LineupGrid,
  SlideFrame,
  SpiritCard,
  WildLine,
  spiritAt,
  type SlideTheme,
} from '@/components/deck/brand'
import { OPENING_CASES, type LocationPitch } from './decks'
import type { DeckSlide } from '@/components/deck/DeckShell'

function themesFor(deck: LocationPitch): Record<string, SlideTheme> {
  const roomAnimal =
    deck.slug === 'on-premise' ? '/images/animal-lioness.png' : '/images/animal-cheetah.png'
  const roomScratch =
    deck.slug === 'on-premise' ? '/images/scratch-lioness.png' : '/images/scratch-cheetah.png'
  return {
    TheRoom: { accent: '#FF8C2A', animal: roomAnimal, scratch: roomScratch },
    TheProduct: { accent: '#FFD700', animal: '/images/animal-cheetah.png' },
    TheWin: { accent: '#9B30FF', animal: '/images/animal-black-panther.png' },
    TheAsk: { accent: '#6B8E23', animal: '/images/animal-cougar.png' },
  }
}

function Frame({
  deck,
  section,
  title,
  intro,
  children,
  hideAnimal,
}: {
  deck: LocationPitch
  section: string
  title: ReactNode
  intro?: ReactNode
  children: ReactNode
  hideAnimal?: boolean
}) {
  return (
    <SlideFrame
      section={section}
      title={title}
      intro={intro}
      hideAnimal={hideAnimal}
      theme={themesFor(deck)[section] ?? themesFor(deck).TheAsk}
    >
      {children}
    </SlideFrame>
  )
}

function CoverSlide({ deck }: { deck: LocationPitch }) {
  const scratch =
    deck.slug === 'on-premise' ? '/images/scratch-lioness.png' : '/images/scratch-cheetah.png'
  return (
    <DeckCover
      scratch={scratch}
      eyebrow={deck.coverEyebrow}
      line={deck.coverLine}
      sub={deck.coverSub}
      footer="Location owner presentation"
    />
  )
}

function ProblemSlide({ deck }: { deck: LocationPitch }) {
  const animal =
    deck.slug === 'on-premise' ? '/images/animal-lioness.png' : '/images/animal-cheetah.png'
  return (
    <Frame deck={deck} section="TheRoom" title={deck.problemTitle} intro={deck.problemIntro} hideAnimal>
      <div className="grid items-center gap-6 md:grid-cols-[0.9fr_1.2fr]">
        <div className="relative hidden h-[52vh] md:block">
          <Image
            src={animal}
            alt=""
            fill
            className="object-contain object-left drop-shadow-2xl"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {deck.problems.map((p, i) => {
            const d = spiritAt(i)
            return (
              <SpiritCard key={p.title} drink={d}>
                <p className="cyber-brush-fix font-wild text-xl" style={{ color: d.colorLight }}>
                  {p.title}
                </p>
                <p className="mt-2 text-sm text-untamed-white-muted">{p.body}</p>
              </SpiritCard>
            )
          })}
        </div>
      </div>
    </Frame>
  )
}

function ProductSlide({ deck }: { deck: LocationPitch }) {
  const hero = drinks[0]
  return (
    <Frame
      deck={deck}
      section="TheProduct"
      title={<>A vodka martini. In a can. On purpose.</>}
      intro="12 oz. 15% ABV. Two 6 oz pours. Spirit-forward — not a lite RTS."
      hideAnimal
    >
      <div className="grid items-center gap-6 md:grid-cols-[0.7fr_1.3fr]">
        <CanHero drink={hero} />
        <div className="grid gap-4 sm:grid-cols-3">
          {ONE_TWO_THREE.items.map((item, i) => {
            const d = spiritAt(i)
            return (
              <SpiritCard key={item.label} drink={d} className="text-center">
                <p className="font-condensed text-5xl font-bold md:text-6xl" style={{ color: d.colorLight }}>
                  {item.num}
                </p>
                <p className="mt-2 font-condensed text-lg font-bold uppercase">{item.label}</p>
                <p className="mt-1 text-sm text-untamed-white-muted">{item.detail}</p>
              </SpiritCard>
            )
          })}
        </div>
      </div>
      <WildLine className="mt-8 text-2xl md:text-4xl">Chill it. Shake it. Unleash it.</WildLine>
    </Frame>
  )
}

function LineupSlide({ deck }: { deck: LocationPitch }) {
  return (
    <Frame
      deck={deck}
      section="TheProduct"
      title={
        <>
          Pick your spirit.{' '}
          <span className="text-gradient-panther">Four wild ones.</span>
        </>
      }
      intro="Four martinis people already know how to order. Identity first — not a flavor wall."
      hideAnimal
    >
      <LineupGrid />
    </Frame>
  )
}

function WhySlide({ deck }: { deck: LocationPitch }) {
  return (
    <Frame
      deck={deck}
      section="TheProduct"
      title={<>Why this one stays</>}
      intro="Premium enough for the guest who knows martinis. Simple enough for the team who has to serve them — or the shopper who has three seconds."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WHY_DIFFERENT.map((w, i) => {
          const d = spiritAt(i)
          return (
            <SpiritCard key={w.title} drink={d} className="p-4">
              <h3 className="font-condensed text-sm font-bold uppercase" style={{ color: d.colorLight }}>
                {w.title}
              </h3>
              <p className="mt-1.5 text-sm text-untamed-white-muted">{w.desc}</p>
            </SpiritCard>
          )
        })}
      </div>
    </Frame>
  )
}

function WinSlide({ deck }: { deck: LocationPitch }) {
  return (
    <Frame deck={deck} section="TheWin" title={deck.winTitle} intro={deck.winIntro}>
      <div className="grid gap-4 sm:grid-cols-2">
        {deck.advantages.map((a, i) => {
          const d = spiritAt(i)
          return (
            <SpiritCard key={a.title} drink={d}>
              <h3 className="cyber-brush-fix font-wild text-xl" style={{ color: d.colorLight }}>
                {a.title}
              </h3>
              <p className="mt-2 text-sm text-untamed-white-muted">{a.description}</p>
            </SpiritCard>
          )
        })}
      </div>
    </Frame>
  )
}

function RunSlide({ deck }: { deck: LocationPitch }) {
  return (
    <Frame deck={deck} section="TheWin" title={deck.runTitle} intro={deck.runIntro}>
      <div className="grid gap-3 sm:grid-cols-2">
        {deck.runItems.map((item, i) => {
          const d = spiritAt(i)
          return (
            <SpiritCard key={item.title} drink={d}>
              <h3 className="font-condensed text-base font-bold uppercase" style={{ color: d.colorLight }}>
                {item.title}
              </h3>
              <p className="mt-1.5 text-sm text-untamed-white-muted">{item.body}</p>
            </SpiritCard>
          )
        })}
      </div>
    </Frame>
  )
}

function CasesSlide({ deck }: { deck: LocationPitch }) {
  const isOn = deck.slug === 'on-premise'
  const boxes = drinks.slice(0, 2)
  return (
    <Frame
      deck={deck}
      section="TheAsk"
      title={<>Start with {OPENING_CASES} cases</>}
      intro={
        isOn
          ? 'Enough for a featured night without committing the whole back bar. See it move. Then decide.'
          : 'Enough to block the cold box and watch depletion. See it move. Then decide.'
      }
      hideAnimal
    >
      <div className="grid items-end gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="flex justify-center gap-4 md:gap-8">
          {boxes.map((d) => (
            <div key={d.slug} className="relative w-36 md:w-52">
              <Image
                src={d.boxWithCanImage}
                alt={`${d.name} case`}
                width={420}
                height={520}
                className="h-auto w-full drop-shadow-2xl"
              />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <SpiritCard drink={drinks[2]}>
            <p className="font-condensed text-xs uppercase tracking-widest text-muted">Opening order</p>
            <p className="mt-1 font-condensed text-5xl font-bold text-[#FFD700]">{OPENING_CASES}</p>
            <p className="mt-1 text-sm text-untamed-white-muted">cases to start</p>
          </SpiritCard>
          <SpiritCard drink={drinks[3]}>
            <p className="font-condensed text-xs uppercase tracking-widest text-muted">SKUs</p>
            <p className="mt-1 font-condensed text-5xl font-bold text-[#FFD700]">4</p>
            <p className="mt-1 text-sm text-untamed-white-muted">or start with the two that fit</p>
          </SpiritCard>
          <p className="font-condensed text-sm uppercase tracking-widest text-untamed-white-muted">
            Next step · 48 hours
          </p>
        </div>
      </div>
    </Frame>
  )
}

function AskSlide({ deck }: { deck: LocationPitch }) {
  return (
    <Frame deck={deck} section="TheAsk" title={<>The ask</>} intro={deck.askIntro}>
      <ol className="space-y-4">
        {deck.askItems.map((t, i) => (
          <li key={t} className="flex items-start gap-4">
            <span className="font-condensed text-2xl font-bold text-[#FFD700]">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="pt-1 text-base text-untamed-white md:text-lg">{t}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href={deck.ctaHref}
          className="inline-flex items-center gap-2 rounded-full bg-[#FF8C2A] px-6 py-3 font-condensed text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-[1.02]"
        >
          {deck.ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href={deck.ctaHref}
          className="inline-flex items-center gap-1.5 font-mono text-sm text-[#FFD700] hover:underline"
        >
          {deck.ctaHref}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <WildLine className="mt-8 text-2xl md:text-4xl">Live Life Untamed</WildLine>
    </Frame>
  )
}

export function slidesFor(deck: LocationPitch): DeckSlide[] {
  return [
    { id: 'cover', section: 'TheRoom', title: 'Cover', render: () => <CoverSlide deck={deck} /> },
    { id: 'problem', section: 'TheRoom', title: 'The Problem', render: () => <ProblemSlide deck={deck} /> },
    { id: 'product', section: 'TheProduct', title: 'The Product', render: () => <ProductSlide deck={deck} /> },
    { id: 'lineup', section: 'TheProduct', title: 'The Lineup', render: () => <LineupSlide deck={deck} /> },
    { id: 'why', section: 'TheProduct', title: 'Why This One', render: () => <WhySlide deck={deck} /> },
    { id: 'win', section: 'TheWin', title: 'What Changes', render: () => <WinSlide deck={deck} /> },
    { id: 'run', section: 'TheWin', title: 'How You Run It', render: () => <RunSlide deck={deck} /> },
    { id: 'cases', section: 'TheAsk', title: 'Two Cases', render: () => <CasesSlide deck={deck} /> },
    { id: 'ask', section: 'TheAsk', title: 'The Ask', render: () => <AskSlide deck={deck} /> },
  ]
}
