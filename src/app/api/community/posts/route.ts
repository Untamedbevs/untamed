import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const revalidate = 60

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

/**
 * GET /api/community/posts
 *
 * Public, cached list of approved + public UGC for the community gallery.
 * Supports `drink`, `featured` and pagination via `limit` + `cursor` (created_at ISO).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const drink = url.searchParams.get('drink')
  const featured = url.searchParams.get('featured')
  const limitParam = Number(url.searchParams.get('limit') || '24')
  const limit = Math.max(1, Math.min(60, isNaN(limitParam) ? 24 : limitParam))
  const cursor = url.searchParams.get('cursor')

  const admin = createAdminClient()

  let query = admin
    .from('ugc_submissions')
    .select(
      `id, caption, drink_slug, tags, location, contributor_display_name, contributor_type, status, created_at,
       assets:ugc_submission_assets(id, asset_type, url, processed_urls, width, height, display_order, processing_status)`
    )
    .eq('is_public', true)
    .in('status', featured === '1' ? ['featured'] : ['approved', 'featured'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (drink) {
    query = query.eq('drink_slug', drink)
  }
  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type AssetRow = {
    id: string
    asset_type: 'image' | 'video'
    url: string
    processed_urls: Record<string, string> | null
    width: number | null
    height: number | null
    display_order: number
    processing_status: 'uploaded' | 'processing' | 'ready' | 'failed'
  }

  const posts: CommunityPost[] = (data || []).map((row) => {
    const rawAssets = ((row as { assets?: AssetRow[] }).assets || []) as AssetRow[]
    return {
      id: row.id as string,
      caption: row.caption as string | null,
      drink_slug: row.drink_slug as string | null,
      tags: (row.tags as string[]) || [],
      location: row.location as string | null,
      contributor_display_name: row.contributor_display_name as string | null,
      contributor_type: row.contributor_type as
        | 'loyalty'
        | 'distributor'
        | 'staff',
      status: row.status as 'approved' | 'featured',
      is_featured: row.status === 'featured',
      created_at: row.created_at as string,
      assets: rawAssets
        .filter((a) =>
          a.asset_type === 'image' ? true : a.processing_status !== 'failed'
        )
        .sort((a, b) => a.display_order - b.display_order)
        .map((a) => ({
          id: a.id,
          asset_type: a.asset_type,
          url: a.url,
          processed_urls: a.processed_urls,
          width: a.width,
          height: a.height,
        })),
    }
  })

  const nextCursor =
    posts.length === limit ? posts[posts.length - 1].created_at : null

  return NextResponse.json(
    { posts, nextCursor },
    {
      headers: {
        'Cache-Control':
          'public, s-maxage=60, stale-while-revalidate=300',
      },
    }
  )
}
