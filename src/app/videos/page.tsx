import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { drinks } from '@/lib/drinks'
import { siteAssetAbsoluteUrl } from '@/lib/site-assets'

export const metadata: Metadata = {
  title: 'Videos | Untamed Beverages',
  description:
    'Approved Untamed videos, the four drink films, Cindy, and more clips.',
}

const APPROVED_ADS = [21, 23, 39, 40, 41, 43, 44, 50, 62, 64, 65, 70, 74, 75, 76, 77, 80, 92, 105]

const WHATSAPP_CLIPS = [
  { title: 'August 24, 3:40 PM', filename: 'August 24 3-40 PM.mp4', path: '/videos/whatsapp-2026-08-24-154053.mp4' },
  { title: 'August 24, 3:46 PM', filename: 'August 24 3-46 PM.mp4', path: '/videos/whatsapp-2026-08-24-154653.mp4' },
  { title: 'August 24, 3:48 PM', filename: 'August 24 3-48 PM.mp4', path: '/videos/whatsapp-2026-08-24-154847.mp4' },
  { title: 'August 24, 3:50 PM', filename: 'August 24 3-50 PM.mp4', path: '/videos/whatsapp-2026-08-24-155003.mp4' },
]

function mixedApprovedClips() {
  const ads = APPROVED_ADS.map((n) => ({
    title: `Video ad ${n}`,
    filename: `Untamed video ad ${n}.mp4`,
    src: siteAssetAbsoluteUrl(`/videos/approved/untamed-video-ad-${n}.mp4`),
  }))
  const clips = WHATSAPP_CLIPS.map((clip) => ({
    title: clip.title,
    filename: clip.filename,
    src: siteAssetAbsoluteUrl(clip.path),
  }))
  const mixed = []
  const every = Math.ceil(ads.length / clips.length)
  let clipIndex = 0
  ads.forEach((ad, index) => {
    mixed.push(ad)
    if ((index + 1) % every === 0 && clipIndex < clips.length) {
      mixed.push(clips[clipIndex])
      clipIndex += 1
    }
  })
  while (clipIndex < clips.length) {
    mixed.push(clips[clipIndex])
    clipIndex += 1
  }
  return mixed
}

export default function VideosPage() {
  const mixedApproved = mixedApprovedClips()

  return (
    <>
      <Navigation />
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
          <h1 className="font-condensed text-4xl sm:text-6xl lg:text-7xl font-bold text-white uppercase text-center mb-12">
            <span className="font-headline text-gradient-wild">Untamed</span> Videos
          </h1>
          <div className="space-y-16">
          <VideoSection
            title="The Drinks"
            subtitle="The film for each can."
          >
            {drinks.map((drink) => (
              <VideoCard
                key={drink.slug}
                title={drink.name}
                filename={`${drink.name}.mp4`}
                subtitle={drink.flavor}
                src={siteAssetAbsoluteUrl(drink.productVideo)}
                poster={siteAssetAbsoluteUrl(drink.productVideoThumb)}
                accent={drink.color}
                href={`/drinks/${drink.slug}`}
              />
            ))}
          </VideoSection>

          <VideoSection
            title="Approved"
            subtitle="Signed off in Company Engineers."
          >
            {mixedApproved.map((clip) => (
              <VideoCard
                key={clip.src}
                title={clip.title}
                filename={clip.filename}
                src={clip.src}
              />
            ))}
          </VideoSection>

          <VideoSection title="Cindy">
            <VideoCard
              title="Cindy"
              filename="Cindy.mp4"
              src={siteAssetAbsoluteUrl('/videos/cindy.mp4')}
            />
          </VideoSection>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

function VideoSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="font-condensed text-3xl sm:text-4xl font-bold text-white uppercase mb-2">
        {title}
      </h2>
      {subtitle ? (
        <p className="text-untamed-white-muted mb-6">{subtitle}</p>
      ) : (
        <div className="mb-6" />
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">{children}</div>
    </section>
  )
}

function VideoCard({
  title,
  filename,
  subtitle,
  src,
  poster,
  accent,
  href,
}: {
  title: string
  filename: string
  subtitle?: string
  src: string
  poster?: string
  accent?: string
  href?: string
}) {
  const heading = href ? (
    <Link href={href} className="hover:opacity-80 transition-opacity" style={{ color: accent }}>
      {title}
    </Link>
  ) : (
    <span style={{ color: accent }}>{title}</span>
  )
  const downloadHref = `/api/videos/download?url=${encodeURIComponent(src)}&filename=${encodeURIComponent(filename)}`

  return (
    <article className="bg-untamed-black/60 border border-untamed-white/10 rounded-2xl overflow-hidden">
      <video
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        className="w-full bg-black"
      />
      <div className="px-3 py-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-condensed text-lg font-bold uppercase tracking-wide text-untamed-white">
            {heading}
          </h3>
          {subtitle ? (
            <p className="text-sm text-untamed-white-muted">{subtitle}</p>
          ) : null}
        </div>
        <a
          href={downloadHref}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-untamed-white/20 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-untamed-white hover:border-untamed-white transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </a>
      </div>
    </article>
  )
}
