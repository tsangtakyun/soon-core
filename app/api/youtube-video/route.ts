function extractYouTubeId(url: string) {
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return url.trim()
}

export async function POST(request: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return Response.json({ error: 'Missing YOUTUBE_API_KEY' }, { status: 500 })
  const body = (await request.json()) as { url?: string }
  const videoId = extractYouTubeId(body.url ?? '')
  if (!videoId) return Response.json({ error: 'Missing YouTube URL' }, { status: 400 })

  const endpoint = new URL('https://www.googleapis.com/youtube/v3/videos')
  endpoint.searchParams.set('part', 'snippet,statistics,contentDetails')
  endpoint.searchParams.set('id', videoId)
  endpoint.searchParams.set('key', apiKey)

  const response = await fetch(endpoint)
  if (!response.ok) return Response.json({ error: await response.text() }, { status: response.status })
  const data = await response.json() as {
    items?: Array<{
      snippet?: { title?: string; publishedAt?: string; thumbnails?: Record<string, { url: string }> }
      statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }
      contentDetails?: { duration?: string }
    }>
  }
  const item = data.items?.[0]
  if (!item) return Response.json({ error: 'Video not found' }, { status: 404 })

  return Response.json({
    platform: 'youtube',
    title: item.snippet?.title ?? '',
    thumbnail: item.snippet?.thumbnails?.maxres?.url ?? item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
    publishDate: item.snippet?.publishedAt?.slice(0, 10) ?? '',
    duration: item.contentDetails?.duration ?? '',
    views: Number(item.statistics?.viewCount ?? 0),
    likes: Number(item.statistics?.likeCount ?? 0),
    comments: Number(item.statistics?.commentCount ?? 0),
  })
}
