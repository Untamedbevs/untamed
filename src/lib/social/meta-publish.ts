const GRAPH_API = 'https://graph.facebook.com/v21.0'

function getEnv() {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  const fbPageId = process.env.META_FB_PAGE_ID
  const igUserId = process.env.META_IG_USER_ID
  if (!token) throw new Error('META_PAGE_ACCESS_TOKEN not set')
  return { token, fbPageId, igUserId }
}

async function graphPost(path: string, body: Record<string, unknown>) {
  const { token } = getEnv()
  const res = await fetch(`${GRAPH_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: token }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message || `Graph API error: ${res.status}`)
  }
  return json
}

async function graphGet(path: string, params: Record<string, string> = {}) {
  const { token } = getEnv()
  const qs = new URLSearchParams({ ...params, access_token: token })
  const res = await fetch(`${GRAPH_API}${path}?${qs}`)
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message || `Graph API error: ${res.status}`)
  }
  return json
}

export interface PublishResult {
  platform: string
  success: boolean
  postId?: string
  containerId?: string
  error?: string
}

export async function publishToFacebook(opts: {
  imageUrl?: string
  videoUrl?: string
  caption: string
  scheduledAt?: Date
}): Promise<PublishResult> {
  const { fbPageId } = getEnv()
  if (!fbPageId) return { platform: 'facebook', success: false, error: 'META_FB_PAGE_ID not set' }

  try {
    const isVideo = !!opts.videoUrl
    const endpoint = isVideo ? `/${fbPageId}/videos` : `/${fbPageId}/photos`

    const body: Record<string, unknown> = {
      ...(isVideo ? { file_url: opts.videoUrl } : { url: opts.imageUrl }),
      caption: opts.caption,
    }

    if (opts.scheduledAt && opts.scheduledAt.getTime() > Date.now() + 600_000) {
      body.published = false
      body.scheduled_publish_time = Math.floor(opts.scheduledAt.getTime() / 1000)
    }

    const result = await graphPost(endpoint, body)
    return { platform: 'facebook', success: true, postId: result.id || result.post_id }
  } catch (err) {
    return { platform: 'facebook', success: false, error: (err as Error).message }
  }
}

export async function publishToInstagram(opts: {
  imageUrl?: string
  videoUrl?: string
  caption: string
  carouselUrls?: string[]
}): Promise<PublishResult> {
  const { igUserId } = getEnv()
  if (!igUserId) return { platform: 'instagram', success: false, error: 'META_IG_USER_ID not set' }

  try {
    if (opts.carouselUrls && opts.carouselUrls.length > 1) {
      return await publishInstagramCarousel(igUserId, opts.carouselUrls, opts.caption)
    }

    const isVideo = !!opts.videoUrl
    const containerBody: Record<string, unknown> = {
      caption: opts.caption,
      ...(isVideo
        ? { media_type: 'VIDEO', video_url: opts.videoUrl }
        : { image_url: opts.imageUrl }),
    }

    const container = await graphPost(`/${igUserId}/media`, containerBody)
    const containerId = container.id

    await waitForContainer(containerId)

    const published = await graphPost(`/${igUserId}/media_publish`, {
      creation_id: containerId,
    })

    return { platform: 'instagram', success: true, postId: published.id, containerId }
  } catch (err) {
    return { platform: 'instagram', success: false, error: (err as Error).message }
  }
}

async function publishInstagramCarousel(
  igUserId: string,
  urls: string[],
  caption: string
): Promise<PublishResult> {
  const childIds: string[] = []

  for (const url of urls) {
    const isVideo = /\.(mp4|mov|webm)$/i.test(url)
    const body: Record<string, unknown> = {
      is_carousel_item: true,
      ...(isVideo
        ? { media_type: 'VIDEO', video_url: url }
        : { image_url: url }),
    }
    const child = await graphPost(`/${igUserId}/media`, body)
    childIds.push(child.id)
  }

  for (const cid of childIds) {
    await waitForContainer(cid)
  }

  const carousel = await graphPost(`/${igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: childIds,
    caption,
  })

  await waitForContainer(carousel.id)

  const published = await graphPost(`/${igUserId}/media_publish`, {
    creation_id: carousel.id,
  })

  return { platform: 'instagram', success: true, postId: published.id, containerId: carousel.id }
}

async function waitForContainer(containerId: string, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await graphGet(`/${containerId}`, { fields: 'status_code' })
    if (status.status_code === 'FINISHED') return
    if (status.status_code === 'ERROR') {
      throw new Error(`Container ${containerId} failed processing`)
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`Container ${containerId} timed out after ${maxAttempts * 2}s`)
}
