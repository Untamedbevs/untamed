'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera, Loader2, Sparkles } from 'lucide-react'
import { UgcVideo } from '@/components/ugc/UgcVideo'

interface CommunityAsset {
  id: string
  asset_type: 'image' | 'video'
  url: string
  processed_urls: Record<string, string> | null
  width: number | null
  height: number | null
}

interface CommunityPost {
  id: string
  caption: string | null
  drink_slug: string | null
  tags: string[]
  location: string | null
  contributor_display_name: string | null
  contributor_type: 'loyalty' | 'distributor' | 'staff'
  status: 'approved' | 'featured'
  is_featured: boolean
  created_at: string
  assets: CommunityAsset[]
}

interface CommunityGalleryProps {
  drinks: { slug: string; name: string }[]
}

const PAGE_SIZE = 24

export function CommunityGallery({ drinks }: CommunityGalleryProps) {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [drinkFilter, setDrinkFilter] = useState<string>('')
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const fetchPosts = useCallback(
    async (opts: { reset: boolean; cursor?: string | null }) => {
      const setLoaderFn = opts.reset ? setLoading : setLoadingMore
      setLoaderFn(true)
      setError('')

      try {
        const params = new URLSearchParams()
        params.set('limit', String(PAGE_SIZE))
        if (drinkFilter) params.set('drink', drinkFilter)
        if (featuredOnly) params.set('featured', '1')
        if (opts.cursor) params.set('cursor', opts.cursor)

        const res = await fetch(`/api/community/posts?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to load community posts')
        const data = await res.json()
        const fetched = (data.posts as CommunityPost[]) || []
        setPosts((prev) => (opts.reset ? fetched : [...prev, ...fetched]))
        setCursor(data.nextCursor as string | null)
        setHasMore(Boolean(data.nextCursor))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoaderFn(false)
      }
    },
    [drinkFilter, featuredOnly]
  )

  useEffect(() => {
    fetchPosts({ reset: true })
  }, [fetchPosts])

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setDrinkFilter('')
              setFeaturedOnly(false)
            }}
            className={`px-4 py-2 rounded-full text-sm transition-colors ${
              !drinkFilter && !featuredOnly
                ? 'bg-white text-black'
                : 'bg-untamed-white/5 border border-untamed-white/15 text-untamed-white-muted hover:border-white'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => {
              setFeaturedOnly(true)
              setDrinkFilter('')
            }}
            className={`px-4 py-2 rounded-full text-sm transition-colors inline-flex items-center gap-1.5 ${
              featuredOnly
                ? 'bg-lioness text-black'
                : 'bg-untamed-white/5 border border-untamed-white/15 text-untamed-white-muted hover:border-lioness'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Featured
          </button>
          {drinks.map((d) => (
            <button
              key={d.slug}
              type="button"
              onClick={() => {
                setDrinkFilter(d.slug)
                setFeaturedOnly(false)
              }}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                drinkFilter === d.slug
                  ? 'bg-white text-black'
                  : 'bg-untamed-white/5 border border-untamed-white/15 text-untamed-white-muted hover:border-white'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>

        <Link
          href="/portal/ugc/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-untamed-white text-black text-sm font-semibold hover:bg-untamed-white/90 transition-colors"
        >
          <Camera className="w-4 h-4" />
          Submit yours
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-untamed-white-muted gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading community posts...
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-untamed-white-muted">
          <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No posts yet for this filter. Be the first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {posts.map((post) => (
            <CommunityCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {hasMore && !loading && posts.length > 0 && (
        <div className="text-center pt-6">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => fetchPosts({ reset: false, cursor })}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-untamed-white/5 border border-untamed-white/15 text-untamed-white text-sm hover:border-white transition-colors disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
            Load more
          </button>
        </div>
      )}
    </section>
  )
}

function CommunityCard({ post }: { post: CommunityPost }) {
  const primary = post.assets[0]
  if (!primary) return null
  return (
    <article className="group relative bg-untamed-black/60 border border-untamed-white/10 rounded-2xl overflow-hidden">
      <div className="relative aspect-square bg-black">
        {primary.asset_type === 'video' ? (
          <UgcVideo
            src={primary.url}
            processedUrls={primary.processed_urls}
            context="list"
            controls
            lazy
            className="w-full h-full"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primary.url}
            alt={post.caption || 'Community post'}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {post.is_featured && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-lioness text-black text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            Featured
          </span>
        )}
      </div>
      {(post.caption || post.contributor_display_name) && (
        <div className="p-3 space-y-1">
          {post.caption && (
            <p className="text-sm text-untamed-white line-clamp-2">
              {post.caption}
            </p>
          )}
          <p className="text-xs text-untamed-white-muted">
            {post.contributor_display_name ||
              (post.contributor_type === 'distributor'
                ? 'Untamed partner'
                : 'Untamed member')}
            {post.location ? ` · ${post.location}` : ''}
          </p>
        </div>
      )}
    </article>
  )
}
