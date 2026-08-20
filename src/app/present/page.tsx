import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { LOCATION_DECKS } from './decks'

const CANS_GROUP = '/brand-kit/cans/cans-group-front.png'

export const metadata: Metadata = {
  title: 'Location Presentations | Untamed Beverages',
  description: 'On-premise and off-premise decks for pitching location owners.',
  robots: { index: false, follow: false },
}

const HUB = [
  {
    deck: LOCATION_DECKS['on-premise'],
    animal: '/images/animal-lioness.png',
    scratch: '/images/scratch-lioness.png',
    accent: '#FF8C2A',
  },
  {
    deck: LOCATION_DECKS['off-premise'],
    animal: '/images/animal-cheetah.png',
    scratch: '/images/scratch-cheetah.png',
    accent: '#E6D800',
  },
] as const

export default function PresentHubPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-untamed-black text-untamed-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: 'url(/images/scratch-panther.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="relative z-10 mx-auto max-w-5xl px-6 py-16">
        <p className="font-condensed text-xs uppercase tracking-[0.3em] text-[#FF8C2A]">Present</p>
        <h1 className="mt-2 font-headline text-4xl uppercase md:text-6xl">Pitch the location</h1>
        <p className="cyber-brush-fix mt-3 font-wild text-2xl text-gradient-wild md:text-4xl">
          Same product. Different room.
        </p>
        <p className="mt-4 max-w-xl text-untamed-white-muted">
          Open one with the owner. Print to PDF if you need a leave-behind.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {HUB.map(({ deck, animal, scratch, accent }) => (
            <Link
              key={deck.slug}
              href={`/present/${deck.slug}`}
              className="group relative overflow-hidden rounded-3xl border bg-untamed-black-card"
              style={{ borderColor: `${accent}55` }}
            >
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `url(${scratch})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <Image
                src={animal}
                alt=""
                width={420}
                height={420}
                className="pointer-events-none absolute -right-8 bottom-0 h-[70%] w-auto opacity-30"
              />
              <div className="relative z-10 flex min-h-[320px] flex-col justify-between p-7">
                <div>
                  <p
                    className="font-condensed text-xs uppercase tracking-[0.3em]"
                    style={{ color: accent }}
                  >
                    {deck.chromeLabel}
                  </p>
                  <h2 className="mt-3 font-condensed text-3xl font-bold uppercase leading-tight">
                    {deck.title}
                  </h2>
                  <p className="mt-3 max-w-sm text-sm text-untamed-white-muted">{deck.description}</p>
                </div>
                <p className="inline-flex items-center gap-1.5 font-mono text-sm text-[#FFD700]">
                  /present/{deck.slug}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </p>
              </div>
            </Link>
          ))}
        </div>
        <div className="pointer-events-none mt-8 flex justify-center opacity-80">
          <Image
            src={CANS_GROUP}
            alt=""
            width={900}
            height={400}
            className="h-auto w-[70%] max-w-lg"
          />
        </div>
      </div>
    </div>
  )
}
