function extractMediaId(url: string) {
  const trimmed = url.trim()
  const direct = trimmed.match(/^\d+$/)
  if (direct) return trimmed
  const match = trimmed.match(/(?:reel|p|tv)\/([^/?#]+)/)
  return match?.[1] ?? trimmed
}

export async function POST(request: Request) {
  const accessToken = process.env.META_ACCESS_TOKEN
  if (!accessToken) return Response.json({ error: 'Missing META_ACCESS_TOKEN' }, { status: 500 })
  const body = (await request.json()) as { url?: string }
  const mediaId = extractMediaId(body.url ?? '')
  if (!mediaId) return Response.json({ error: 'Missing Meta media ID or URL' }, { status: 400 })

  const endpoint = new URL(`https://graph.facebook.com/v18.0/${mediaId}`)
  endpoint.searchParams.set('fields', 'timestamp,media_type,thumbnail_url,like_count,comments_count,reach,saved,shares,video_views,ig_reels_avg_watch_time,ig_reels_video_view_total_time')
  endpoint.searchParams.set('access_token', accessToken)
  const response = await fetch(endpoint)
  if (!response.ok) {
    const errorText = await response.text()
    try {
      const parsed = JSON.parse(errorText) as { error?: { message?: string; code?: number; type?: string } }
      const code = parsed.error?.code
      const type = parsed.error?.type ?? ''
      if (code === 190 || type === 'OAuthException') {
        return Response.json(
          { error: 'Meta access token 已過期或無效。請到設定重新輸入有效嘅 access token。', code: 190 },
          { status: 401 },
        )
      }
      return Response.json({ error: parsed.error?.message ?? errorText, code }, { status: response.status })
    } catch {
      return Response.json({ error: errorText }, { status: response.status })
    }
  }
  const data = await response.json() as Record<string, unknown>

  return Response.json({
    platform: 'instagram',
    thumbnail: String(data.thumbnail_url ?? ''),
    publishDate: String(data.timestamp ?? '').slice(0, 10),
    views: Number(data.video_views ?? data.reach ?? 0),
    likes: Number(data.like_count ?? 0),
    comments: Number(data.comments_count ?? 0),
    saves: Number(data.saved ?? 0),
    shares: Number(data.shares ?? 0),
    avgWatchTime: String(data.ig_reels_avg_watch_time ?? ''),
    totalWatchTime: String(data.ig_reels_video_view_total_time ?? ''),
  })
}
