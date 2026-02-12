'use client'

import Image from 'next/image'
import { drinks } from '@/lib/drinks'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

/* ============================================
   Font Preview Component
   ============================================ */
function FontPreview({
  name,
  cssVar,
  description,
  label,
}: {
  name: string
  cssVar: string
  description: string
  label: string
}) {
  return (
    <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 md:p-8">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-untamed-white text-sm font-semibold mb-1">{name}</p>
          <p className="text-untamed-white-muted text-xs">{description}</p>
        </div>
        <span className="text-xs font-mono text-untamed-white-muted/60 bg-untamed-black px-2 py-1 rounded">
          {label}
        </span>
      </div>

      {/* Show each drink name in this font */}
      <div className="space-y-3 mb-6">
        {drinks.map((drink) => (
          <p
            key={drink.slug}
            className="text-4xl md:text-5xl lg:text-6xl uppercase tracking-wider"
            style={{ fontFamily: `var(${cssVar})`, color: drink.color }}
          >
            {drink.name}
          </p>
        ))}
      </div>

      {/* Full alphabet */}
      <div className="border-t border-card-border pt-4">
        <p
          className="text-2xl md:text-3xl uppercase tracking-wider text-untamed-white/80"
          style={{ fontFamily: `var(${cssVar})` }}
        >
          ABCDEFGHIJKLM
        </p>
        <p
          className="text-2xl md:text-3xl uppercase tracking-wider text-untamed-white/80"
          style={{ fontFamily: `var(${cssVar})` }}
        >
          NOPQRSTUVWXYZ
        </p>
        <p
          className="text-2xl md:text-3xl tracking-wider text-untamed-white/60"
          style={{ fontFamily: `var(${cssVar})` }}
        >
          0123456789 !@#$%
        </p>
      </div>
    </div>
  )
}

/* ============================================
   Color Swatch Component
   ============================================ */
function ColorSwatch({
  name,
  hex,
  cssVar,
  variants,
}: {
  name: string
  hex: string
  cssVar: string
  variants?: { label: string; hex: string }[]
}) {
  return (
    <div className="rounded-2xl border border-card-border bg-untamed-black-card overflow-hidden">
      <div className="h-24 md:h-32" style={{ backgroundColor: hex }} />
      <div className="p-4">
        <p className="text-untamed-white font-semibold text-sm mb-1">{name}</p>
        <p className="text-untamed-white-muted text-xs font-mono">{hex}</p>
        <p className="text-untamed-white-muted/60 text-xs font-mono">var({cssVar})</p>
        {variants && (
          <div className="flex gap-2 mt-3">
            {variants.map((v) => (
              <div key={v.label} className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded-full border border-card-border"
                  style={{ backgroundColor: v.hex }}
                />
                <span className="text-[10px] text-untamed-white-muted">{v.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================
   DESIGN SYSTEM PAGE
   ============================================ */
export default function DesignSystemPage() {
  return (
    <>
      <Navigation />

      <main className="pt-24 pb-20">
        <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 lg:px-12">

          {/* ============================================
              HEADER
              ============================================ */}
          <section className="mb-16 md:mb-24">
            <div className="flex items-center gap-4 mb-6">
              <Image
                src="/images/logo-mark.png"
                alt="Untamed Beverages"
                width={64}
                height={64}
                className="w-14 h-14 md:w-16 md:h-16"
              />
              <div>
                <h1 className="font-[var(--font-oswald)] text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wider text-untamed-white">
                  Design System
                </h1>
                <p className="text-untamed-white-muted text-sm md:text-base">
                  Untamed Beverages Brand Kit
                </p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-panther via-cheetah to-lioness" />
          </section>

          {/* ============================================
              BRAND IDENTITY
              ============================================ */}
          <section className="mb-16 md:mb-24">
            <SectionHeader title="Brand Identity" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <Image
                    src="/images/logo-mark.png"
                    alt="Logo Mark"
                    width={100}
                    height={100}
                    className="w-20 h-20 md:w-24 md:h-24"
                  />
                  <Image
                    src="/images/logo-text.png"
                    alt="Logo Text"
                    width={280}
                    height={56}
                    className="h-10 md:h-14 w-auto"
                  />
                </div>
                <p className="text-untamed-white-muted text-sm leading-relaxed mb-4">
                  The Untamed mark features a half-woman, half-leopard face -- representing the duality
                  of sophistication and wild instinct. The golden eye is a signature detail.
                </p>
                <p className="text-untamed-white-muted text-sm leading-relaxed">
                  Tagline: <span className="text-untamed-white italic">&ldquo;Get In Touch With Your Wild Side&rdquo;</span>
                </p>
                <p className="text-untamed-white-muted text-sm leading-relaxed">
                  Ritual: <span className="text-untamed-white italic">&ldquo;Chill it. Shake it. Unleash it!&rdquo;</span>
                </p>
              </div>
              <div className="rounded-2xl border border-card-border bg-untamed-black-card p-8 text-center">
                <p className="text-untamed-white-muted text-xs uppercase tracking-wider mb-4">Logo on Dark</p>
                <div className="flex items-center justify-center gap-4">
                  <Image
                    src="/images/logo-mark.png"
                    alt="Logo Mark"
                    width={80}
                    height={80}
                    className="w-16 h-16"
                  />
                  <Image
                    src="/images/logo-text.png"
                    alt="Logo Text"
                    width={200}
                    height={40}
                    className="h-8 w-auto"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ============================================
              COLORS
              ============================================ */}
          <section className="mb-16 md:mb-24">
            <SectionHeader title="Color Palette" />

            {/* Drink Colors */}
            <p className="text-untamed-white text-sm font-semibold mb-4 uppercase tracking-wider">Drink Accent Colors</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <ColorSwatch
                name="Black Panther"
                hex="#7B2D8E"
                cssVar="--panther"
                variants={[
                  { label: 'Light', hex: '#9B30FF' },
                  { label: 'Dark', hex: '#5A1F6A' },
                ]}
              />
              <ColorSwatch
                name="Cheetah"
                hex="#D4D700"
                cssVar="--cheetah"
                variants={[
                  { label: 'Light', hex: '#E6D800' },
                  { label: 'Dark', hex: '#9E9E00' },
                ]}
              />
              <ColorSwatch
                name="Cougar"
                hex="#4A7C0F"
                cssVar="--cougar"
                variants={[
                  { label: 'Light', hex: '#6B8E23' },
                  { label: 'Dark', hex: '#355E0A' },
                ]}
              />
              <ColorSwatch
                name="Lioness"
                hex="#E87511"
                cssVar="--lioness"
                variants={[
                  { label: 'Light', hex: '#FF8C2A' },
                  { label: 'Dark', hex: '#D4680F' },
                ]}
              />
            </div>

            {/* Base / UI Colors */}
            <p className="text-untamed-white text-sm font-semibold mb-4 uppercase tracking-wider">Base & UI Colors</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <ColorSwatch name="Black" hex="#0A0A0A" cssVar="--untamed-black" />
              <ColorSwatch name="Black Light" hex="#1A1A1A" cssVar="--untamed-black-light" />
              <ColorSwatch name="Card BG" hex="#141414" cssVar="--untamed-black-card" />
              <ColorSwatch name="Card Border" hex="#2A2A2A" cssVar="--card-border" />
              <ColorSwatch name="Muted" hex="#666666" cssVar="--muted" />
              <ColorSwatch name="White" hex="#FAFAFA" cssVar="--untamed-white" />
            </div>
          </section>

          {/* ============================================
              TYPOGRAPHY - FONT COMPARISON
              ============================================ */}
          <section className="mb-16 md:mb-24">
            <SectionHeader title="Display Font Options" subtitle="Compare these aggressive fonts for drink names and headings. Pick your favorite." />

            <div className="space-y-8">
              {/* Current: Oswald */}
              <FontPreview
                name="Oswald"
                cssVar="--font-oswald"
                description="Current display font. Clean, condensed, strong. Military precision."
                label="CURRENT"
              />

              {/* Option 1: Metal Mania */}
              <FontPreview
                name="Metal Mania"
                cssVar="--font-metal-mania"
                description="Distressed, rugged, loud. Closest to the scratchy claw-mark style."
                label="OPTION A"
              />

              {/* Option 2: Permanent Marker */}
              <FontPreview
                name="Permanent Marker"
                cssVar="--font-permanent-marker"
                description="Bold hand-drawn marker. Street art energy, casual aggression."
                label="OPTION B"
              />

              {/* Option 3: Rubik Dirt */}
              <FontPreview
                name="Rubik Dirt"
                cssVar="--font-rubik-dirt"
                description="Dirty/distressed geometric. Gritty texture with modern structure."
                label="OPTION C"
              />
            </div>
          </section>

          {/* ============================================
              TYPOGRAPHY SCALE
              ============================================ */}
          <section className="mb-16 md:mb-24">
            <SectionHeader title="Typography Scale" />

            <div className="space-y-6 rounded-2xl border border-card-border bg-untamed-black-card p-6 md:p-8">
              <div className="border-b border-card-border pb-4">
                <p className="text-untamed-white-muted text-xs uppercase tracking-wider mb-3">Display / Heading (Oswald)</p>
                <p className="font-[var(--font-oswald)] text-6xl md:text-7xl lg:text-8xl font-bold uppercase tracking-wider text-untamed-white">Unleash</p>
                <p className="font-[var(--font-oswald)] text-4xl md:text-5xl font-bold uppercase tracking-wider text-untamed-white/80">Section Title</p>
                <p className="font-[var(--font-oswald)] text-2xl md:text-3xl font-bold uppercase tracking-wider text-untamed-white/60">Card Heading</p>
                <p className="font-[var(--font-oswald)] text-xl font-semibold uppercase tracking-wider text-untamed-white/40">Label Text</p>
              </div>

              <div>
                <p className="text-untamed-white-muted text-xs uppercase tracking-wider mb-3">Body (Inter)</p>
                <p className="text-xl text-untamed-white mb-2">Body Large -- Premium ready-to-drink vodka martinis.</p>
                <p className="text-base text-untamed-white/80 mb-2">Body Default -- Get in touch with your wild side. Four premium cocktails, four wild spirits.</p>
                <p className="text-sm text-untamed-white/60 mb-2">Body Small -- 12 FL OZ / 355mL. 15% ALC/VOL. 2 Vodka Martinis Per Can.</p>
                <p className="text-xs text-untamed-white/40">Caption -- Always drink responsibly. Must be 21+.</p>
              </div>
            </div>
          </section>

          {/* ============================================
              DRINK CARDS
              ============================================ */}
          <section className="mb-16 md:mb-24">
            <SectionHeader title="Drink Identity Cards" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {drinks.map((drink) => (
                <div
                  key={drink.slug}
                  className="rounded-2xl border bg-untamed-black-card overflow-hidden"
                  style={{ borderColor: `${drink.color}40` }}
                >
                  {/* Header bar */}
                  <div className="px-6 py-3 flex items-center justify-between" style={{ backgroundColor: `${drink.color}15` }}>
                    <span className="font-[var(--font-oswald)] text-lg font-bold uppercase tracking-wider" style={{ color: drink.color }}>
                      {drink.name}
                    </span>
                    <span className="text-xs font-mono" style={{ color: drink.color }}>{drink.color}</span>
                  </div>

                  <div className="p-6 flex gap-6">
                    {/* Can */}
                    <div className="relative w-16 h-32 shrink-0">
                      <Image
                        src={drink.canImage}
                        alt={drink.name}
                        fill
                        className="object-contain"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-untamed-white font-medium mb-1">{drink.flavor}</p>
                      <p className="text-untamed-white-muted text-sm mb-3">{drink.subtitle}</p>

                      {/* Color swatches inline */}
                      <div className="flex gap-2 mb-3">
                        {[
                          { label: 'Main', hex: drink.color },
                          { label: 'Light', hex: drink.colorLight },
                          { label: 'Dark', hex: drink.colorDark },
                        ].map((c) => (
                          <div key={c.label} className="flex items-center gap-1">
                            <div className="w-4 h-4 rounded-full border border-card-border" style={{ backgroundColor: c.hex }} />
                            <span className="text-[10px] text-untamed-white-muted">{c.label}</span>
                          </div>
                        ))}
                      </div>

                      <p className="text-untamed-white-muted text-xs italic">&ldquo;{drink.tagline}&rdquo;</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ============================================
              COMPONENTS SHOWCASE
              ============================================ */}
          <section className="mb-16 md:mb-24">
            <SectionHeader title="UI Components" />

            {/* Buttons */}
            <p className="text-untamed-white text-sm font-semibold mb-4 uppercase tracking-wider">Buttons</p>
            <div className="flex flex-wrap gap-4 mb-10">
              <button className="px-8 py-3 bg-untamed-white text-untamed-black font-semibold rounded-full hover:opacity-90 transition-all duration-300">
                Primary CTA
              </button>
              <button className="px-8 py-3 border border-untamed-white-muted/30 text-untamed-white-muted font-medium rounded-full hover:border-untamed-white hover:text-untamed-white transition-all duration-300">
                Secondary
              </button>
              {drinks.map((drink) => (
                <button
                  key={drink.slug}
                  className="px-6 py-2.5 rounded-full font-medium text-sm border transition-all duration-300"
                  style={{
                    borderColor: `${drink.color}40`,
                    color: drink.color,
                  }}
                >
                  {drink.name}
                </button>
              ))}
            </div>

            {/* Cards */}
            <p className="text-untamed-white text-sm font-semibold mb-4 uppercase tracking-wider">Cards</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
              <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6">
                <p className="text-untamed-white font-semibold mb-2">Default Card</p>
                <p className="text-untamed-white-muted text-sm">Standard card with #141414 bg and #2A2A2A border.</p>
              </div>
              <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 hover:border-panther hover:shadow-[0_0_30px_rgba(155,48,255,0.2)] transition-all duration-300">
                <p className="text-untamed-white font-semibold mb-2">Hover Glow Card</p>
                <p className="text-untamed-white-muted text-sm">Border and glow shift to drink accent on hover.</p>
              </div>
              <div className="rounded-2xl border-2 p-6" style={{ borderColor: '#FFD700', background: 'linear-gradient(135deg, rgba(255,215,0,0.05), rgba(255,165,0,0.05))' }}>
                <p className="text-untamed-white font-semibold mb-2">Accent Card</p>
                <p className="text-untamed-white-muted text-sm">Gold gradient background with accent border.</p>
              </div>
            </div>

            {/* Badges / Pills */}
            <p className="text-untamed-white text-sm font-semibold mb-4 uppercase tracking-wider">Badges & Pills</p>
            <div className="flex flex-wrap gap-3 mb-10">
              {drinks.map((drink) => (
                <span
                  key={drink.slug}
                  className="px-4 py-1.5 rounded-full text-xs font-medium border"
                  style={{ borderColor: `${drink.color}40`, color: drink.color, backgroundColor: `${drink.color}10` }}
                >
                  {drink.abv} ALC/VOL
                </span>
              ))}
              <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-untamed-white text-untamed-black">
                Premium
              </span>
              <span className="px-4 py-1.5 rounded-full text-xs font-medium border border-card-border text-untamed-white-muted">
                12 FL OZ
              </span>
            </div>

            {/* Glass / Gradient Effects */}
            <p className="text-untamed-white text-sm font-semibold mb-4 uppercase tracking-wider">Effects</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="glass rounded-2xl p-6">
                <p className="text-untamed-white font-semibold mb-2">Glass Morphism</p>
                <p className="text-untamed-white-muted text-sm">blur(20px) backdrop with subtle border. Used for overlays.</p>
              </div>
              <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #7B2D8E20, #E8751120)' }}>
                <p className="text-untamed-white font-semibold mb-2">Gradient Background</p>
                <p className="text-untamed-white-muted text-sm">Panther to Lioness subtle gradient. Used for hero sections.</p>
              </div>
            </div>
          </section>

          {/* ============================================
              SPACING & LAYOUT
              ============================================ */}
          <section className="mb-16 md:mb-24">
            <SectionHeader title="Spacing & Layout" />
            <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="text-untamed-white font-semibold mb-4">Container Widths</p>
                  <div className="space-y-3">
                    {[
                      { label: 'max-w-7xl', value: '1280px', usage: 'Content areas' },
                      { label: 'max-w-screen-2xl', value: '1536px', usage: 'Footer, wide sections' },
                      { label: 'max-w-5xl', value: '1024px', usage: 'Narrow content' },
                      { label: 'max-w-md', value: '448px', usage: 'Modals, forms' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-untamed-white-muted">{item.label}</span>
                        <span className="text-untamed-white-muted/60">{item.value} -- {item.usage}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-untamed-white font-semibold mb-4">Design Tokens</p>
                  <div className="space-y-3">
                    {[
                      { label: 'Border Radius', value: 'rounded-2xl (16px)' },
                      { label: 'Button Radius', value: 'rounded-full (pill)' },
                      { label: 'Card Padding', value: 'p-6 md:p-8' },
                      { label: 'Section Gap', value: 'mb-12 to mb-16' },
                      { label: 'Transition', value: 'duration-300 ease' },
                      { label: 'Hover Lift', value: '-translate-y-1 scale-[1.02]' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span className="text-untamed-white-muted">{item.label}</span>
                        <span className="font-mono text-untamed-white-muted/60">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================
              ANIMATION
              ============================================ */}
          <section>
            <SectionHeader title="Animations" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 text-center">
                <div className="w-12 h-12 bg-panther rounded-full mx-auto mb-4 animate-float" />
                <p className="text-untamed-white text-sm font-semibold">Float</p>
                <p className="text-untamed-white-muted text-xs">6s ease-in-out infinite</p>
                <p className="font-mono text-untamed-white-muted/60 text-xs mt-1">.animate-float</p>
              </div>
              <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 text-center">
                <div className="w-12 h-12 bg-cheetah rounded-full mx-auto mb-4 animate-pulse-glow" />
                <p className="text-untamed-white text-sm font-semibold">Pulse Glow</p>
                <p className="text-untamed-white-muted text-xs">3s ease-in-out infinite</p>
                <p className="font-mono text-untamed-white-muted/60 text-xs mt-1">.animate-pulse-glow</p>
              </div>
              <div className="rounded-2xl border border-card-border bg-untamed-black-card p-6 text-center">
                <div className="w-12 h-12 bg-lioness rounded-full mx-auto mb-4 animate-spin" style={{ animationDuration: '3s' }} />
                <p className="text-untamed-white text-sm font-semibold">Spin (loading)</p>
                <p className="text-untamed-white-muted text-xs">3s linear infinite</p>
                <p className="font-mono text-untamed-white-muted/60 text-xs mt-1">.animate-spin</p>
              </div>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </>
  )
}

/* ============================================
   Section Header Helper
   ============================================ */
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h2 className="font-[var(--font-oswald)] text-2xl md:text-3xl font-bold uppercase tracking-wider text-untamed-white mb-2">
        {title}
      </h2>
      {subtitle && <p className="text-untamed-white-muted text-sm md:text-base">{subtitle}</p>}
      <div className="h-px bg-card-border mt-4" />
    </div>
  )
}
