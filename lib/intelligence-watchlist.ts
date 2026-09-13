import { createHash } from 'node:crypto'

export type WatchlistRow = {
  id: string
  workspace_id: string
  platform: 'instagram' | 'facebook' | 'threads'
  collection_mode: 'owned_account' | 'public_account' | 'keyword' | 'hashtag'
  identifier: string
  label: string | null
  learning_focus: string | null
  industry_codes: string[]
  consent_basis: 'soon_owned' | 'client_authorized' | 'public_research'
  cadence_hours: number
}

export type CapturedSocialItem = {
  platformItemId: string
  sourceUrl: string
  sourceAccount?: string
  contentText?: string
  mediaType?: string
  thumbnailUrl?: string
  mediaChildren: CapturedMediaChild[]
  publishedAt?: string
  rawPayload: Record<string, unknown>
}

export type CapturedMediaChild = {
  id: string
  media_type: string
  media_url: string | null
  thumbnail_url: string | null
}

export type MetaCollectorCredentials = {
  instagramAccessToken?: string
  instagramUserId?: string
  facebookPageAccessToken?: string
  threadsAccessToken?: string
}

const graphVersion = process.env.META_GRAPH_API_VERSION ?? 'v24.0'

function cleanIdentifier(value: string) {
  return value.trim().replace(/^@/, '').slice(0, 180)
}

function mediaChildren(value: unknown): CapturedMediaChild[] {
  const data = (value as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) return []
  return data.flatMap((child) => {
    if (!child || typeof child !== 'object') return []
    const item = child as Record<string, unknown>
    const id = typeof item.id === 'string' ? item.id : ''
    if (!id) return []
    return [{
      id,
      media_type: typeof item.media_type === 'string' ? item.media_type : 'UNKNOWN',
      media_url: typeof item.media_url === 'string' && item.media_url ? item.media_url : null,
      thumbnail_url: typeof item.thumbnail_url === 'string' && item.thumbnail_url ? item.thumbnail_url : null,
    }]
  })
}

async function graphJson(url: URL, token: string) {
  url.searchParams.set('access_token', token)
  const response = await fetch(url, { cache: 'no-store' })
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    const graphError = body.error as { message?: string } | undefined
    throw new Error(graphError?.message || `Meta API ${response.status}`)
  }
  return body
}

export async function collectWatchlist(row: WatchlistRow, credentials: MetaCollectorCredentials = {}): Promise<CapturedSocialItem[]> {
  const identifier = cleanIdentifier(row.identifier)
  if (row.platform === 'threads') {
    const token = credentials.threadsAccessToken ?? process.env.META_THREADS_ACCESS_TOKEN
    if (!token) throw new Error('等待設定 Threads access token')
    if (!['keyword', 'hashtag'].includes(row.collection_mode)) throw new Error('Threads 第一版只支援關鍵字或 topic tag')
    const url = new URL('https://graph.threads.net/keyword_search')
    url.searchParams.set('q', identifier)
    url.searchParams.set('search_type', 'RECENT')
    url.searchParams.set('search_mode', row.collection_mode === 'hashtag' ? 'TAG' : 'KEYWORD')
    url.searchParams.set('limit', '25')
    url.searchParams.set('fields', 'id,media_type,media_url,permalink,username,text,timestamp,thumbnail_url')
    const body = await graphJson(url, token)
    return ((body.data ?? []) as Array<Record<string, unknown>>).map((item) => ({
      platformItemId: String(item.id), sourceUrl: String(item.permalink ?? ''), sourceAccount: String(item.username ?? ''),
      contentText: String(item.text ?? ''), mediaType: String(item.media_type ?? ''), thumbnailUrl: String(item.thumbnail_url ?? item.media_url ?? ''),
      mediaChildren: [], publishedAt: String(item.timestamp ?? ''), rawPayload: item,
    })).filter((item) => item.platformItemId && item.sourceUrl)
  }

  if (row.platform === 'instagram') {
    const token = credentials.instagramAccessToken ?? process.env.META_INSTAGRAM_ACCESS_TOKEN
    if (!token) throw new Error('等待設定 Instagram Business access')
    if (row.collection_mode !== 'public_account') throw new Error('已連接帳號成效繼續由 EGG 同步；此 collector 用於公開專業帳號')
    let igUserId = credentials.instagramUserId ?? process.env.META_INSTAGRAM_USER_ID
    if (!igUserId) {
      const accountsUrl = new URL(`https://graph.facebook.com/${graphVersion}/me/accounts`)
      accountsUrl.searchParams.set('fields', 'instagram_business_account')
      const accounts = await graphJson(accountsUrl, token)
      const page = ((accounts.data ?? []) as Array<{ instagram_business_account?: { id?: string } }>).find((item) => item.instagram_business_account?.id)
      igUserId = page?.instagram_business_account?.id
    }
    if (!igUserId) throw new Error('Meta 帳號未連接 Instagram Professional account')
    const url = new URL(`https://graph.facebook.com/${graphVersion}/${igUserId}`)
    const baseFields = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp'
    url.searchParams.set('fields', `business_discovery.username(${identifier}){username,media.limit(50){${baseFields},children{id,media_type,media_url,thumbnail_url}}}`)
    let body: Record<string, unknown>
    try {
      body = await graphJson(url, token)
    } catch (error) {
      // A stale Graph version or restricted account may reject nested children.
      // Keep cover-level capture working; a later run can safely backfill pages.
      url.searchParams.set('fields', `business_discovery.username(${identifier}){username,media.limit(50){${baseFields}}}`)
      body = await graphJson(url, token).catch(() => { throw error })
    }
    const discovery = body.business_discovery as { username?: string; media?: { data?: Array<Record<string, unknown>> } } | undefined
    const discoveredItems = discovery?.media?.data ?? []
    const items = await Promise.all(discoveredItems.map(async (item) => {
      if (item.media_type !== 'CAROUSEL_ALBUM' || mediaChildren(item.children).length) return item
      const childUrl = new URL(`https://graph.facebook.com/${graphVersion}/${String(item.id)}/children`)
      childUrl.searchParams.set('fields', 'id,media_type,media_url,thumbnail_url')
      const children = await graphJson(childUrl, token).catch(() => null)
      return children ? { ...item, children } : item
    }))
    return items.map((item) => ({
      platformItemId: String(item.id), sourceUrl: String(item.permalink ?? ''), sourceAccount: discovery?.username ?? identifier,
      contentText: String(item.caption ?? ''), mediaType: String(item.media_type ?? ''), thumbnailUrl: String(item.thumbnail_url ?? item.media_url ?? ''),
      mediaChildren: item.media_type === 'CAROUSEL_ALBUM' ? mediaChildren(item.children) : [],
      publishedAt: String(item.timestamp ?? ''), rawPayload: item,
    })).filter((item) => item.platformItemId && item.sourceUrl)
  }

  const token = credentials.facebookPageAccessToken ?? process.env.META_FACEBOOK_PAGE_ACCESS_TOKEN
  if (!token) throw new Error('等待設定 Facebook Page access token')
  if (!['owned_account', 'public_account'].includes(row.collection_mode)) throw new Error('Facebook 第一版只支援 Page')
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${identifier}/posts`)
  url.searchParams.set('limit', '25')
  url.searchParams.set('fields', 'id,message,permalink_url,created_time,full_picture,attachments{media_type}')
  const body = await graphJson(url, token)
  return ((body.data ?? []) as Array<Record<string, unknown>>).map((item) => ({
    platformItemId: String(item.id), sourceUrl: String(item.permalink_url ?? ''), sourceAccount: row.label ?? identifier,
    contentText: String(item.message ?? ''), mediaType: 'POST', thumbnailUrl: String(item.full_picture ?? ''),
    mediaChildren: [], publishedAt: String(item.created_time ?? ''), rawPayload: item,
  })).filter((item) => item.platformItemId && item.sourceUrl)
}

export function captureHash(item: CapturedSocialItem) {
  return createHash('sha256').update(`${item.sourceUrl}\n${item.contentText ?? ''}`).digest('hex')
}
