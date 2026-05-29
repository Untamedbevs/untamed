'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Camera, Sparkles } from 'lucide-react'
import { UgcVideo } from '@/components/ugc/UgcVideo'

interface CommunityAsset {
  id: string
  asset_type: 'image' | 'video'
  url: string
  processed_urls: Record<string, string> | null
}

interface CommunityPost {
  id: string
  caption: string | null
  contributor_display_name: string | null
  contributor_type: 'loyalty' | 'distributor' | 'staff'
  is_featured: boolean
  assets: CommunityAsset[]
}

/**
 * Featured Community strip for the marketing homepage.
 *
 * Pulls the latest 8 featured public UGC posts from /api/community/posts.
 * Renders nothing if the API fails or returns zero posts (so a fresh install
 * with no approved content doesn't show an empty section on the homepage).
 */
export function HomeCommunityStrip() {
  const [posts, setPosts] = useState<CommunityPost[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/community/posts?featured=1&limit=8')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const list = (data?.posts as CommunityPost[]) || []
        // Only render when there's enough content for the strip to look full
        setPosts(list.filter((p) => p.assets.length > 0))
      })
      .catch(() => {
        if (!cancelled) setPosts([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!posts || posts.length < 4) return null

  return (
    <section className="relative py-20 md:py-28 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-0 w-96 h-96 rounded-full blur-[180px] opacity-10 bg-[#9B30FF]" />
        <div className="absolute bottom-1/3 left-0 w-96 h-96 rounded-full blur-[180px] opacity-10 bg-cougar" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#9B30FF]/30 bg-[#9B30FF]/10 text-sm font-medium mb-6 text-[#9B30FF]">
            <Sparkles className="w-4 h-4" />
            From the Pack
          </div>

          <h2 className="font-condensed text-4xl sm:text-5xl lg:text-6xl font-bold text-white uppercase mb-4">
            Real Moments,{' '}
            <span className="font-headline text-gradient-wild">Real Members</span>
          </h2>

          <p className="text-lg text-untamed-white-muted max-w-2xl mx-auto">
            Photos and videos from the Untamed community. Submit yours and earn loyalty points.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10">
          {posts.slice(0, 8).map((post, idx) => {
            const primary = post.assets[0]
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
                className="group relative aspect-square rounded-2xl overflow-hidden border border-untamed-white/10 bg-black"
              >
                {primary.asset_type === 'video' ? (
                  <UgcVideo
                    src={primary.url}
                    processedUrls={primary.processed_urls}
                    context="list"
                    controls={false}
                    autoplay
                    muted
                    loop
                    lazy
                    className="w-full h-full"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={primary.url}
                    alt={post.caption || 'Untamed community post'}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}

                {post.is_featured && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-lioness text-black text-[10px] font-bold uppercase tracking-wider">
                    <Sparkles className="w-3 h-3" />
                    Featured
                  </span>
                )}

                {post.contributor_display_name && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs text-white truncate">
                      @{post.contributor_display_name}
                    </p>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/community"
            className="px-7 py-3 bg-untamed-white text-untamed-black font-semibold text-base rounded-full hover:bg-[#9B30FF] hover:text-white transition-all duration-300 hover:shadow-[0_0_30px_rgba(155,48,255,0.4)] active:scale-95 inline-flex items-center gap-2"
          >
            See the gallery
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/portal/login?returnTo=/portal/ugc/new"
            className="px-7 py-3 border border-[#9B30FF]/40 text-[#9B30FF] font-medium text-base rounded-full hover:border-[#9B30FF] hover:bg-[#9B30FF]/10 transition-all duration-300 active:scale-95 inline-flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            Submit yours
          </Link>
        </div>
      </div>
    </section>
  )
}
