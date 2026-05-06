'use client'

const SAMPLE_TEXT = 'The quick brown fox jumps over the lazy dog'
const BRUSH_VAR = '--font-cyber-brush'
const BRAND_SAMPLES = ['Black Panther', 'Cheetah', 'Cougar', 'Lioness']

const fonts = [
  {
    name: 'Cyber Brush',
    variable: '--font-cyber-brush',
    description: 'Used for "Wild Side" text and cat names',
    weights: ['Normal'],
  },
  {
    name: 'Dirty Headline',
    variable: '--font-dirty-headline',
    description: 'Headline / display font',
    weights: ['Normal'],
  },
  {
    name: 'Helvetica Neue Condensed',
    variable: '--font-helvetica-condensed',
    description: 'Condensed body and UI text',
    weights: ['400 (Regular)', '700 (Bold)'],
  },
  {
    name: 'Oswald',
    variable: '--font-oswald',
    description: 'Current section headings',
    weights: ['400', '500', '600', '700'],
  },
  {
    name: 'Inter',
    variable: '--font-inter',
    description: 'Default body / sans-serif',
    weights: ['Variable'],
  },
  {
    name: 'Metal Mania',
    variable: '--font-metal-mania',
    description: 'Decorative / metal style',
    weights: ['400'],
  },
  {
    name: 'Permanent Marker',
    variable: '--font-permanent-marker',
    description: 'Marker / handwritten style',
    weights: ['400'],
  },
  {
    name: 'Rubik Dirt',
    variable: '--font-rubik-dirt',
    description: 'Textured / gritty style',
    weights: ['400'],
  },
]

const sizes = [
  { label: '9xl', className: 'text-9xl' },
  { label: '7xl', className: 'text-7xl' },
  { label: '5xl', className: 'text-5xl' },
  { label: '3xl', className: 'text-3xl' },
  { label: 'xl', className: 'text-xl' },
  { label: 'base', className: 'text-base' },
]

export default function FontsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div>
        <h1 className="font-[var(--font-oswald)] text-3xl font-bold uppercase tracking-wider text-white mb-2">
          Font Library
        </h1>
        <p className="text-[#A0A0A0] text-sm">
          All fonts loaded on the site. Use <code className="text-[#9B30FF] bg-[#9B30FF]/10 px-1.5 py-0.5 rounded text-xs">font-[var(--font-name)]</code> in Tailwind classes.
        </p>
      </div>

      {fonts.map((font) => (
        <section
          key={font.variable}
          className="rounded-2xl border border-[#2A2A2A] bg-[#111]"
        >
          {/* Header */}
          <div className="flex items-baseline justify-between gap-4 px-6 py-4 border-b border-[#2A2A2A] bg-[#0D0D0D]">
            <div>
              <h2 className="text-white text-lg font-semibold">{font.name}</h2>
              <p className="text-[#666] text-xs mt-0.5">{font.description}</p>
            </div>
            <code className="text-[#9B30FF] text-xs bg-[#9B30FF]/10 px-2 py-1 rounded shrink-0">
              {font.variable}
            </code>
          </div>

          {/* Weights */}
          <div className="px-6 py-3 border-b border-[#2A2A2A] flex gap-2 flex-wrap">
            {font.weights.map((w) => (
              <span key={w} className="text-[10px] uppercase tracking-wider text-[#666] bg-[#1A1A1A] px-2 py-0.5 rounded">
                {w}
              </span>
            ))}
          </div>

          {/* Pangram at multiple sizes */}
          <div className="px-6 py-6 space-y-4">
            {sizes.map((size) => (
              <div key={size.label} className="flex items-baseline gap-4">
                <span className="text-[10px] text-[#666] uppercase tracking-wider w-10 shrink-0 text-right">
                  {size.label}
                </span>
                <p
                  className={`${size.className} text-white leading-tight truncate ${font.variable === BRUSH_VAR ? 'cyber-brush-fix' : ''}`}
                  style={{ fontFamily: `var(${font.variable})` }}
                >
                  {SAMPLE_TEXT}
                </p>
              </div>
            ))}
          </div>

          {/* Brand samples */}
          <div className="px-6 py-5 border-t border-[#2A2A2A] bg-[#0D0D0D]">
            <p className="text-[10px] uppercase tracking-wider text-[#666] mb-3">Brand Names</p>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              {BRAND_SAMPLES.map((name) => (
                <span
                  key={name}
                  className={`text-4xl text-white ${font.variable === BRUSH_VAR ? 'cyber-brush-fix' : ''}`}
                  style={{ fontFamily: `var(${font.variable})` }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Wild Side preview */}
          <div className="px-6 py-5 border-t border-[#2A2A2A]">
            <p className="text-[10px] uppercase tracking-wider text-[#666] mb-3">&ldquo;Wild Side&rdquo; Preview</p>
            <p className="text-2xl text-[#A0A0A0]">
              Get In Touch With Your{' '}
              <span
                className={`text-4xl ${font.variable === BRUSH_VAR ? 'cyber-brush-fix' : ''}`}
                style={{
                  fontFamily: `var(${font.variable})`,
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Wild Side
              </span>
            </p>
          </div>
        </section>
      ))}

      {/* Side-by-side comparison */}
      <section className="rounded-2xl border border-[#2A2A2A] bg-[#111]">
        <div className="px-6 py-4 border-b border-[#2A2A2A] bg-[#0D0D0D] rounded-t-2xl">
          <h2 className="text-white text-lg font-semibold">Side-by-Side: Cat Names</h2>
          <p className="text-[#666] text-xs mt-0.5">Compare how each font renders the drink names</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#2A2A2A]">
                <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-[#666] font-medium">Font</th>
                {BRAND_SAMPLES.map((name) => (
                  <th key={name} className="px-6 py-3 text-[10px] uppercase tracking-wider text-[#666] font-medium">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fonts.map((font) => (
                <tr key={font.variable} className="border-b border-[#2A2A2A] last:border-0">
                  <td className="px-6 py-4">
                    <span className="text-xs text-[#A0A0A0]">{font.name}</span>
                  </td>
                  {BRAND_SAMPLES.map((name, i) => {
                    const colors = ['#9B30FF', '#D4D700', '#6B8E23', '#FF8C2A']
                    return (
                      <td key={name} className="px-6 py-4">
                        <span
                          className={`text-3xl ${font.variable === BRUSH_VAR ? 'cyber-brush-fix' : ''}`}
                          style={{
                            fontFamily: `var(${font.variable})`,
                            color: colors[i],
                          }}
                        >
                          {name}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
