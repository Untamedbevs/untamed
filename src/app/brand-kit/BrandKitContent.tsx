'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Download,
  Copy,
  Check,
  Quote,
  Hash,
  Volume2,
  Megaphone,
  Camera,
  Package,
  Type as TypeIcon,
  Palette,
} from 'lucide-react'
import { drinks } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

/* ============================================
   Reusable bits
   ============================================ */

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="mb-8">
      {eyebrow && (
        <p className="text-[#FFD700] text-xs font-semibold uppercase tracking-[0.2em] mb-2">
          {eyebrow}
        </p>
      )}
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-6 h-6 text-untamed-white-muted" />}
        <h2 className="font-condensed text-2xl md:text-4xl font-bold uppercase tracking-wider text-untamed-white">
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="text-untamed-white-muted text-sm md:text-base mt-2 max-w-3xl">{subtitle}</p>
      )}
      <div className="h-px bg-card-border mt-5" />
    </div>
  )
}

function DownloadButton({
  href,
  label,
  sub,
  primary,
}: {
  href: string
  label: string
  sub?: string
  primary?: boolean
}) {
  return (
    <a
      href={href}
      download
      className={
        primary
          ? 'group inline-flex items-center gap-3 px-7 py-3.5 rounded-full bg-untamed-white text-untamed-black font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:bg-panther-light hover:text-white hover:shadow-[0_0_30px_rgba(155,48,255,0.4)]'
          : 'group inline-flex items-center gap-3 px-5 py-3 rounded-full border border-card-border bg-untamed-black-card text-untamed-white transition-all duration-300 hover:-translate-y-0.5 hover:border-untamed-white-muted'
      }
    >
      <Download className="w-4 h-4 shrink-0" />
      <span className="flex flex-col leading-tight text-left">
        <span className="text-sm font-medium">{label}</span>
        {sub && <span className="text-[11px] text-current/60">{sub}</span>}
      </span>
    </a>
  )
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      className="inline-flex items-center gap-1.5 font-mono text-xs text-untamed-white-muted hover:text-untamed-white transition-colors duration-200"
      aria-label={`Copy ${value}`}
    >
      {value}
      {copied ? (
        <Check className="w-3 h-3 text-[#39FF14]" />
      ) : (
        <Copy className="w-3 h-3 opacity-60" />
      )}
    </button>
  )
}

function ColorSwatch({
  name,
  hex,
  sub,
}: {
  name: string
  hex: string
  sub?: string
}) {
  return (
    <div className="rounded-2xl border border-card-border bg-untamed-black-card overflow-hidden">
      <div className="h-20 md:h-24" style={{ backgroundColor: hex }} />
      <div className="p-3">
        <p className="text-untamed-white text-xs font-semibold">{name}</p>
        {sub && <p className="text-untamed-white-muted/60 text-[10px] mb-1">{sub}</p>}
        <CopyChip value={hex} />
      </div>
    </div>
  )
}

/* ============================================
   Static brand data (mirrors src/lib/brand-kit.ts)
   ============================================ */

const TAGLINES = [
  'Martinis With an Attitude.',
  'Unleash Your Nature.',
  'Get In Touch With Your Wild Side.',
  'Chill it. Shake it. Unleash it.',
  'Live Life Untamed.',
  'Which Cat Are You?',
  'Two martinis. One can. Zero compromise.',
]

const VOICE_DO = [
  'Short, punchy lines',
  'Double entendres',
  'Animal & predator metaphors',
  'Nightlife language',
  'Confident, premium tone',
]

const VOICE_DONT = [
  'Generic "cheers" language',
  'Discount / sale language',
  'Emojis in captions',
  'Trying too hard',
  'Anything that feels cheap',
]

const HASHTAGS_CORE = ['#Untamed', '#UntamedBevs', '#UnleashYourNature']
const HASHTAGS_SECONDARY = [
  '#PremiumVodka',
  '#MartiniCulture',
  '#NightlifeEssential',
  '#CocktailArt',
]

const PERSONAS = [
  {
    title: 'The Home Host',
    desc: 'Wants bar-quality martinis without the bar. Stocks the fridge, impresses guests, skips the bartending.',
  },
  {
    title: 'The Value-Premium Buyer',
    desc: 'Loves premium but does the math. $3 per cocktail vs $16 at a bar is an easy yes.',
  },
  {
    title: 'The Identity Seeker',
    desc: 'Picks a cat that matches their mood and personality. The brand is a vibe, not just a drink.',
  },
  {
    title: 'The Gifter',
    desc: 'Sends premium cocktails for birthdays, celebrations, and "new chapter" moments.',
  },
]

const CONTENT_ANGLES = [
  {
    title: '"Which Cat Are You?"',
    desc: 'Persona quizzes, polls, and this-or-that reels matching each big cat to a personality.',
  },
  {
    title: 'Proof of the pour',
    desc: 'Two full martinis poured from a single can — the clearest way to show the value.',
  },
  {
    title: 'The ritual',
    desc: 'Chill it. Shake it. Unleash it. A repeatable 3-beat reel format for any flavor.',
  },
  {
    title: 'Occasion sets',
    desc: 'Hosting, gifting, weekend reset, "new chapter" moments — stock-the-fridge content.',
  },
  {
    title: 'The value math',
    desc: '$24 four-pack = 8 cocktails = $3 each. Compare to a $16 bar martini.',
  },
  {
    title: 'Community / UGC',
    desc: 'Reshare members who tag @untamedbevs unleashing it in the wild.',
  },
]

const FONTS = [
  {
    name: 'Cyber Brush',
    role: 'Wild script — drink names, "Wild Side", "Unleash it"',
    cssVar: '--font-cyber-brush',
    sample: 'Untamed',
    big: true,
  },
  {
    name: 'Dirty Headline',
    role: 'The "Untamed" wordmark & expressive headings',
    cssVar: '--font-dirty-headline',
    sample: 'UNTAMED',
    big: true,
  },
  {
    name: 'Helvetica Neue Condensed',
    role: 'Display headings, stats, section titles',
    cssVar: '--font-helvetica-condensed',
    sample: 'UNLEASH YOUR NATURE',
    big: false,
  },
  {
    name: 'Inter',
    role: 'Body copy & UI text',
    cssVar: '--font-inter',
    sample: 'Premium ready-to-serve vodka martinis.',
    big: false,
  },
]

/* ============================================
   PAGE
   ============================================ */

export function BrandKitContent() {
  return (
    <>
      <Navigation />

      <main className="pt-8 md:pt-10 pb-20">
        {/* Ambient glow */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-panther/20 blur-[150px] animate-pulse-glow" />
          <div className="absolute top-1/3 -right-40 w-[420px] h-[420px] rounded-full bg-lioness/10 blur-[150px] animate-pulse-glow" />
        </div>

        <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 lg:px-12">
          {/* ============ HERO ============ */}
          <section className="mb-20 md:mb-28">
            <div className="flex items-center gap-4 mb-8">
              <Image
                src="/images/logo-mark.png"
                alt="Untamed Beverages"
                width={72}
                height={72}
                className="w-14 h-14 md:w-16 md:h-16"
              />
              <Image
                src="/images/logo-text.png"
                alt="Untamed Beverages"
                width={240}
                height={48}
                className="h-7 md:h-9 w-auto"
              />
            </div>

            <p className="text-[#FFD700] text-xs font-semibold uppercase tracking-[0.3em] mb-4">
              Official Brand Kit
            </p>
            <h1 className="font-condensed text-5xl md:text-7xl lg:text-8xl font-bold uppercase tracking-wider text-untamed-white max-w-5xl">
              Everything you need to{' '}
              <span className="text-gradient-wild">unleash the brand</span>
            </h1>
            <p className="text-untamed-white-muted text-base md:text-lg mt-6 max-w-2xl leading-relaxed">
              Logos, fonts, colors, voice, and campaign-ready messaging for Untamed Beverages.
              Built for our social media team, press, and partners. Everything here is approved for
              use.
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-8">
              <DownloadButton
                href="/brand-kit/untamed-brand-kit.pdf"
                label="Download Brand Kit PDF"
                sub="The full one-sheet, ready to share"
                primary
              />
              <DownloadButton
                href="/brand-kit/untamed-brand-kit.zip"
                label="Download Full Asset Kit"
                sub="PDF, logos, fonts, cans, colors (.zip)"
              />
              <DownloadButton
                href="/brand-kit/untamed-social-media-guide.txt"
                label="Quick Guide"
                sub="One-page text cheat sheet"
              />
            </div>

            <div className="h-px bg-gradient-to-r from-panther via-cheetah to-lioness mt-12" />
          </section>

          {/* ============ SNAPSHOT ============ */}
          <section className="mb-20 md:mb-28">
            <SectionHeader
              eyebrow="Start here"
              title="The Brand at a Glance"
              subtitle="If you only read one section, read this one."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 md:p-8">
                <p className="text-untamed-white-muted text-sm leading-relaxed">
                  <span className="font-headline text-untamed-white text-lg">Untamed</span>{' '}
                  Beverages makes premium ready-to-serve vodka martinis. Each 12 oz can is 15%
                  ALC/VOL and holds{' '}
                  <span className="text-untamed-white font-medium">two full martinis</span>. Founded
                  by three couples around a backyard fire pit, the brand is built on one idea:
                  bar-quality cocktails without the friction or the pretension.
                </p>
                <p className="text-untamed-white-muted text-sm leading-relaxed mt-4">
                  The line is four big cats — each a personality, a flavor, and a color. Customers
                  don&rsquo;t just pick a drink, they pick a cat.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { k: 'Format', v: '2 martinis / can', s: '12 oz · 15% ABV' },
                  { k: 'Value', v: '$3 / cocktail', s: '$24 four-pack' },
                  { k: 'Products', v: '4 big cats', s: 'one per personality' },
                  { k: 'Handle', v: '@untamedbevs', s: 'Instagram' },
                ].map((item) => (
                  <div
                    key={item.k}
                    className="rounded-2xl border border-card-border bg-untamed-black-card p-5 flex flex-col justify-center"
                  >
                    <p className="text-untamed-white-muted/60 text-[10px] uppercase tracking-wider mb-1">
                      {item.k}
                    </p>
                    <p className="font-condensed text-xl md:text-2xl font-bold uppercase tracking-wide text-untamed-white">
                      {item.v}
                    </p>
                    <p className="text-untamed-white-muted text-xs mt-0.5">{item.s}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============ 1-2-3 ADVANTAGE ============ */}
          <section className="mb-20 md:mb-28">
            <SectionHeader
              eyebrow="The hook"
              title="The 1-2-3 Advantage"
              subtitle="Our core value story. Work it into everything — it is the fastest way to make the brand make sense."
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { n: '1', t: 'Can', d: '12 oz · 15% ABV of premium vodka martini.' },
                { n: '2', t: 'Martinis', d: 'Two full 6 oz pours inside every single can.' },
                { n: '$3', t: 'Per Cocktail', d: 'Luxury meets logic. $24 for a four-pack.' },
              ].map((s) => (
                <div
                  key={s.t}
                  className="rounded-2xl border-2 p-8 text-center"
                  style={{
                    borderColor: '#FFD70033',
                    background:
                      'linear-gradient(135deg, rgba(255,215,0,0.05), rgba(255,165,0,0.05))',
                  }}
                >
                  <p className="font-condensed text-6xl md:text-7xl font-bold text-gradient-wild leading-none mb-3">
                    {s.n}
                  </p>
                  <p className="font-condensed text-xl font-bold uppercase tracking-wider text-untamed-white mb-2">
                    {s.t}
                  </p>
                  <p className="text-untamed-white-muted text-sm">{s.d}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ============ PRODUCT LINE ============ */}
          <section className="mb-20 md:mb-28">
            <SectionHeader
              eyebrow="The line"
              title="Four Wild Spirits"
              subtitle="Each can is a flavor, a personality, and a color. Lead with the cat."
              icon={Package}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {drinks.map((drink) => (
                <div
                  key={drink.slug}
                  className="rounded-2xl border bg-untamed-black-card overflow-hidden transition-all duration-300 hover:-translate-y-1"
                  style={{ borderColor: `${drink.color}40` }}
                >
                  <div
                    className="px-6 py-3 flex items-center justify-between"
                    style={{ backgroundColor: `${drink.color}15` }}
                  >
                    <span
                      className="font-wild cyber-brush-fix text-2xl tracking-wide"
                      style={{ color: drink.colorLight }}
                    >
                      {drink.name}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-untamed-white-muted">
                      {drink.flavor}
                    </span>
                  </div>

                  <div className="p-6 flex gap-6">
                    <div className="relative w-20 h-40 shrink-0">
                      <Image
                        src={siteAssetAbsoluteUrl(drink.canImage)}
                        alt={drink.name}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-untamed-white font-medium">{drink.subtitle}</p>
                      <p className="text-untamed-white-muted text-xs mb-3">
                        {drink.size} · {drink.abv} ALC/VOL · {drink.servings}
                      </p>
                      <p
                        className="text-sm italic mb-4 leading-snug"
                        style={{ color: drink.colorLight }}
                      >
                        &ldquo;{drink.tagline}&rdquo;
                      </p>
                      <div className="flex gap-2">
                        {[
                          { label: 'Main', hex: drink.color },
                          { label: 'Light', hex: drink.colorLight },
                          { label: 'Dark', hex: drink.colorDark },
                        ].map((c) => (
                          <div key={c.label} className="flex flex-col items-center gap-1">
                            <div
                              className="w-7 h-7 rounded-full border border-card-border"
                              style={{ backgroundColor: c.hex }}
                            />
                            <CopyChip value={c.hex} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ============ MESSAGING ============ */}
          <section className="mb-20 md:mb-28">
            <SectionHeader
              eyebrow="Say this"
              title="Messaging & Taglines"
              subtitle="Approved, campaign-ready lines. Tap any to copy."
              icon={Quote}
            />
            <div className="flex flex-wrap gap-3 mb-8">
              {TAGLINES.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-card-border bg-untamed-black-card px-5 py-2.5 text-sm text-untamed-white"
                >
                  <CopyChipText value={t} />
                </span>
              ))}
            </div>
            <div className="rounded-2xl border-2 border-panther/40 bg-gradient-to-br from-panther/10 to-transparent p-8 text-center">
              <p className="text-untamed-white-muted text-xs uppercase tracking-[0.2em] mb-3">
                The Ritual
              </p>
              <p className="font-wild text-4xl md:text-5xl text-gradient-wild">
                Chill it. Shake it. Unleash it.
              </p>
            </div>
          </section>

          {/* ============ VOICE ============ */}
          <section className="mb-20 md:mb-28">
            <SectionHeader
              eyebrow="Sound like this"
              title="Brand Voice"
              subtitle="Confident, provocative, premium — never try-hard."
              icon={Volume2}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-[#39FF14]/30 bg-untamed-black-card p-6 md:p-8">
                <p className="font-condensed text-xl font-bold uppercase tracking-wider text-[#39FF14] mb-5">
                  Do
                </p>
                <ul className="space-y-3">
                  {VOICE_DO.map((d) => (
                    <li key={d} className="flex items-start gap-3 text-untamed-white text-sm">
                      <Check className="w-4 h-4 text-[#39FF14] mt-0.5 shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-[#FF0040]/30 bg-untamed-black-card p-6 md:p-8">
                <p className="font-condensed text-xl font-bold uppercase tracking-wider text-[#FF0040] mb-5">
                  Don&rsquo;t
                </p>
                <ul className="space-y-3">
                  {VOICE_DONT.map((d) => (
                    <li
                      key={d}
                      className="flex items-start gap-3 text-untamed-white-muted text-sm"
                    >
                      <span className="text-[#FF0040] mt-0.5 shrink-0 font-bold leading-none">
                        &times;
                      </span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ============ HASHTAGS ============ */}
          <section className="mb-20 md:mb-28">
            <SectionHeader
              eyebrow="Tag it"
              title="Hashtags & Handle"
              icon={Hash}
            />
            <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 md:p-8">
              <p className="text-untamed-white-muted text-xs uppercase tracking-wider mb-3">
                Always use
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                {HASHTAGS_CORE.map((h) => (
                  <span
                    key={h}
                    className="rounded-full bg-panther-light/15 border border-panther-light/40 px-4 py-2 text-sm text-panther-light"
                  >
                    <CopyChipText value={h} colorClass="text-panther-light" />
                  </span>
                ))}
              </div>
              <p className="text-untamed-white-muted text-xs uppercase tracking-wider mb-3">
                Mix in
              </p>
              <div className="flex flex-wrap gap-3">
                {HASHTAGS_SECONDARY.map((h) => (
                  <span
                    key={h}
                    className="rounded-full border border-card-border px-4 py-2 text-sm text-untamed-white-muted"
                  >
                    <CopyChipText value={h} />
                  </span>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-card-border">
                <p className="text-untamed-white-muted text-sm">
                  Tag the brand:{' '}
                  <a
                    href="https://instagram.com/untamedbevs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#FFD700] font-medium hover:underline"
                  >
                    @untamedbevs
                  </a>
                </p>
              </div>
            </div>
          </section>

          {/* ============ AUDIENCE ============ */}
          <section className="mb-20 md:mb-28">
            <SectionHeader
              eyebrow="Talk to them"
              title="Who We're Talking To"
              subtitle="Adults 21+ who want bar-quality martinis at home — identity-driven, value-conscious, lifestyle-led."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {PERSONAS.map((p) => (
                <div
                  key={p.title}
                  className="rounded-2xl border border-card-border bg-untamed-black-card p-6"
                >
                  <p className="font-condensed text-lg font-bold uppercase tracking-wider text-untamed-white mb-2">
                    {p.title}
                  </p>
                  <p className="text-untamed-white-muted text-sm leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ============ CONTENT ANGLES ============ */}
          <section className="mb-20 md:mb-28">
            <SectionHeader
              eyebrow="Make this"
              title="Campaign & Content Angles"
              subtitle="Starting points for reels, posts, and series."
              icon={Megaphone}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {CONTENT_ANGLES.map((a) => (
                <div
                  key={a.title}
                  className="rounded-2xl border border-card-border bg-untamed-black-card p-6 hover:border-panther hover:shadow-[0_0_30px_rgba(155,48,255,0.2)] transition-all duration-300"
                >
                  <p className="text-untamed-white font-semibold mb-2">{a.title}</p>
                  <p className="text-untamed-white-muted text-sm leading-relaxed">{a.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ============ LOGO ============ */}
          <section className="mb-20 md:mb-28">
            <SectionHeader
              eyebrow="The mark"
              title="Logo"
              subtitle="The Untamed mark is a half-woman, half-leopard face — the duality of sophistication and wild instinct. The golden eye is the signature detail."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-card-border bg-untamed-black-card p-10 flex items-center justify-center gap-5">
                <Image
                  src="/images/logo-mark.png"
                  alt="Untamed mark"
                  width={120}
                  height={120}
                  className="w-20 h-20 md:w-24 md:h-24"
                />
                <Image
                  src="/images/logo-text.png"
                  alt="Untamed wordmark"
                  width={260}
                  height={52}
                  className="h-10 md:h-12 w-auto"
                />
              </div>
              <div className="rounded-2xl border border-card-border bg-untamed-white p-10 flex items-center justify-center gap-5">
                <Image
                  src="/images/logo-mark.png"
                  alt="Untamed mark on light"
                  width={120}
                  height={120}
                  className="w-20 h-20 md:w-24 md:h-24"
                />
                <span className="font-headline text-3xl md:text-4xl text-untamed-black">
                  UNTAMED
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              <DownloadButton href="/brand-kit/logos/logo-mark.png" label="Logo Mark (PNG)" />
              <DownloadButton href="/brand-kit/logos/logo-text.png" label="Wordmark (PNG)" />
              <DownloadButton
                href="/brand-kit/logos/untamed-logos.zip"
                label="All Logos (.zip)"
              />
            </div>
            <p className="text-untamed-white-muted/60 text-xs mt-4">
              Keep clear space around the mark. Prefer the logo on dark. Don&rsquo;t stretch,
              recolor, or add effects.
            </p>
          </section>

          {/* ============ COLORS ============ */}
          <section className="mb-20 md:mb-28">
            <SectionHeader
              eyebrow="The palette"
              title="Colors"
              subtitle="The brand lives in the dark. Gold is the wild-side highlight. Each cat owns its accent — never mix two product accents in one asset."
              icon={Palette}
            />

            <p className="text-untamed-white text-sm font-semibold mb-4 uppercase tracking-wider">
              Product Accents
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {drinks.map((d) => (
                <ColorSwatch key={d.slug} name={d.name} hex={d.color} sub={d.flavor} />
              ))}
            </div>

            <p className="text-untamed-white text-sm font-semibold mb-4 uppercase tracking-wider">
              Base &amp; Accent
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <ColorSwatch name="Untamed Black" hex="#0A0A0A" sub="background" />
              <ColorSwatch name="Card BG" hex="#141414" />
              <ColorSwatch name="Card Border" hex="#2A2A2A" />
              <ColorSwatch name="Untamed White" hex="#FAFAFA" sub="text" />
              <ColorSwatch name="Gold" hex="#FFD700" sub="wild side" />
              <ColorSwatch name="Amber" hex="#FFA500" sub="wild side" />
            </div>

            <div className="mt-6">
              <DownloadButton
                href="/brand-kit/untamed-colors.txt"
                label="Color Palette (.txt)"
                sub="All hex values & usage notes"
              />
            </div>
          </section>

          {/* ============ TYPOGRAPHY ============ */}
          <section className="mb-20 md:mb-28">
            <SectionHeader
              eyebrow="The type"
              title="Typography"
              subtitle="Custom display fonts for personality, Inter for everything readable."
              icon={TypeIcon}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {FONTS.map((f) => (
                <div
                  key={f.name}
                  className="rounded-2xl border border-card-border bg-untamed-black-card p-6 md:p-8 flex flex-col"
                >
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <p className="text-untamed-white font-semibold">{f.name}</p>
                      <p className="text-untamed-white-muted text-xs mt-0.5 max-w-xs">{f.role}</p>
                    </div>
                  </div>
                  <p
                    className={`text-untamed-white ${f.big ? 'text-5xl md:text-6xl' : 'text-3xl md:text-4xl'} ${
                      f.big ? '' : 'uppercase tracking-wide'
                    } leading-tight`}
                    style={{ fontFamily: `var(${f.cssVar})` }}
                  >
                    {f.sample}
                  </p>
                  <p
                    className="text-untamed-white-muted/70 text-lg mt-4"
                    style={{ fontFamily: `var(${f.cssVar})` }}
                  >
                    ABCDEFGHIJKLMNOPQRSTUVWXYZ
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              <DownloadButton
                href="/brand-kit/fonts/untamed-fonts.zip"
                label="All Brand Fonts (.zip)"
                sub="Cyber Brush, Dirty Headline, Helvetica Condensed"
              />
            </div>
            <p className="text-untamed-white-muted/60 text-xs mt-4">
              Inter is free from Google Fonts. The custom display fonts are licensed for Untamed
              brand use — keep them internal to brand assets.
            </p>
          </section>

          {/* ============ PHOTOGRAPHY ============ */}
          <section className="mb-20 md:mb-28">
            <SectionHeader
              eyebrow="The look"
              title="Photography & Visual Style"
              icon={Camera}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="rounded-2xl border border-card-border bg-untamed-black-card overflow-hidden">
                <div className="relative aspect-[4/3]">
                  <Image
                    src="/brand-kit/cans/cans-group-front.png"
                    alt="Untamed can lineup"
                    fill
                    className="object-contain p-8"
                    unoptimized
                  />
                </div>
              </div>
              <div>
                <p className="text-untamed-white-muted text-sm leading-relaxed mb-6">
                  Dark luxury, nightlife energy, predatory elegance. High-contrast and dramatic —
                  deep shadows with neon rim light, wet and reflective surfaces, smoke and mist.
                  Center-weighted hero shots with negative space for text.
                </p>
                <ul className="space-y-2 text-sm text-untamed-white">
                  {[
                    'Shoot on dark, moody backgrounds',
                    'Use each product\u2019s accent color as rim/glow light',
                    'High contrast, deep depth of field',
                    'Leave negative space for headlines',
                    'Condensation, ice, motion = premium cues',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3">
                      <span className="text-[#FFD700] mt-1 shrink-0">&bull;</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ============ DOWNLOADS ============ */}
          <section>
            <SectionHeader
              eyebrow="Grab it all"
              title="Downloads"
              subtitle="Everything in one place. The full kit includes all of the below."
              icon={Download}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  href: '/brand-kit/untamed-brand-kit.pdf',
                  label: 'Brand Kit PDF',
                  sub: 'Shareable one-sheet (.pdf)',
                  primary: true,
                },
                {
                  href: '/brand-kit/untamed-brand-kit.zip',
                  label: 'Full Asset Kit',
                  sub: 'Everything (.zip)',
                  primary: true,
                },
                {
                  href: '/brand-kit/logos/untamed-logos.zip',
                  label: 'Logos',
                  sub: 'Mark + wordmark (.zip)',
                },
                {
                  href: '/brand-kit/fonts/untamed-fonts.zip',
                  label: 'Fonts',
                  sub: '4 brand typefaces (.zip)',
                },
                {
                  href: '/brand-kit/cans/untamed-cans.zip',
                  label: 'Product Renders',
                  sub: '4 cans + lineup (.zip)',
                },
                {
                  href: '/brand-kit/untamed-colors.txt',
                  label: 'Color Palette',
                  sub: 'All hex values (.txt)',
                },
                {
                  href: '/brand-kit/untamed-social-media-guide.txt',
                  label: 'Social Media Guide',
                  sub: 'One-page cheat sheet (.txt)',
                },
              ].map((d) => (
                <a
                  key={d.href}
                  href={d.href}
                  download
                  className={`group rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 ${
                    d.primary
                      ? 'border-panther-light/50 bg-gradient-to-br from-panther/15 to-transparent hover:shadow-[0_0_30px_rgba(155,48,255,0.25)]'
                      : 'border-card-border bg-untamed-black-card hover:border-untamed-white-muted'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Package
                      className={`w-6 h-6 ${d.primary ? 'text-panther-light' : 'text-untamed-white-muted'}`}
                    />
                    <Download className="w-5 h-5 text-untamed-white-muted group-hover:text-untamed-white transition-colors" />
                  </div>
                  <p className="text-untamed-white font-semibold">{d.label}</p>
                  <p className="text-untamed-white-muted text-xs mt-0.5">{d.sub}</p>
                </a>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-card-border bg-untamed-black-card p-6 text-center">
              <p className="text-untamed-white-muted/60 text-xs">
                Must be 21+. 15% ALC/VOL. Always drink responsibly. &copy;{' '}
                {new Date().getFullYear()} Untamed Beverages, LLC &bull; Parrish, FL 34219 &bull;
                USA
              </p>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </>
  )
}

/* Inline text copy helper (keeps full label visible, copies on click) */
function CopyChipText({
  value,
  colorClass,
}: {
  value: string
  colorClass?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      className={`inline-flex items-center gap-2 ${colorClass ?? 'text-untamed-white'}`}
    >
      {value}
      {copied ? (
        <Check className="w-3.5 h-3.5 text-[#39FF14]" />
      ) : (
        <Copy className="w-3.5 h-3.5 opacity-40" />
      )}
    </button>
  )
}
