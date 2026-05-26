import { XMLParser } from 'fast-xml-parser'

export type NewsItem = {
  title: string
  original_title?: string
  source: string
  url: string
  published_at: string
}

type RssItem = {
  title?: string
  link?: string
  pubDate?: string
  source?: string | { '#text'?: string; '@_url'?: string }
}

type RawItem = NewsItem

const parser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  trimValues: true,
})

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)))
    .trim()
}

function cleanTitle(title: string, source: string) {
  if (!source) return title
  return title.replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '').trim()
}

function hasChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value)
}

function sourceName(source: RssItem['source']) {
  if (!source) return ''
  if (typeof source === 'string') return decodeHtml(source)
  return decodeHtml(source['#text'] ?? '')
}

function normaliseTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\u3400-\u9fff]+/gu, '')
}

function isSimilarTitle(a: string, b: string) {
  const first = normaliseTitle(a)
  const second = normaliseTitle(b)
  if (!first || !second) return false
  if (first === second) return true
  if (first.length > 12 && second.includes(first)) return true
  if (second.length > 12 && first.includes(second)) return true

  const firstTokens = new Set(first.match(/[\p{L}\p{N}\u3400-\u9fff]{2,}/gu) ?? [])
  const secondTokens = new Set(second.match(/[\p{L}\p{N}\u3400-\u9fff]{2,}/gu) ?? [])
  if (firstTokens.size === 0 || secondTokens.size === 0) return false
  const overlap = [...firstTokens].filter((token) => secondTokens.has(token)).length
  return overlap / Math.min(firstTokens.size, secondTokens.size) >= 0.75
}

function dedupeNews(items: NewsItem[]) {
  const deduped: NewsItem[] = []
  const seen = new Set<string>()

  for (const item of items) {
    const key = normaliseTitle(item.original_title || item.title)
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
  }

  return deduped
}

function getFeedItems(xml: string): RssItem[] {
  const parsed = parser.parse(xml)
  const items = parsed?.rss?.channel?.item ?? []
  return Array.isArray(items) ? items : [items]
}

function parseFeed(xml: string): RawItem[] {
  return getFeedItems(xml)
    .map((item) => {
      const source = sourceName(item.source)
      const title = cleanTitle(decodeHtml(String(item.title ?? '')), source)
      const publishedDate = item.pubDate ? new Date(item.pubDate) : null
      const publishedAt = publishedDate && !Number.isNaN(publishedDate.getTime()) ? publishedDate.toISOString() : ''

      return {
        title,
        original_title: title,
        source,
        url: decodeHtml(String(item.link ?? '')),
        published_at: publishedAt,
      }
    })
    .filter((item) => item.title && item.url && item.published_at)
}

async function fetchRss(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SOON-Core/1.0',
    },
    next: { revalidate: 0 },
  })
  if (!response.ok) throw new Error(`Google News RSS returned ${response.status}`)
  return response.text()
}

async function fetchRSSItems(query: string, lang: 'zh' | 'en'): Promise<RawItem[]> {
  const encodedQuery = encodeURIComponent(query)
  const rssUrl = lang === 'zh'
    ? `https://news.google.com/rss/search?q=${encodedQuery}&hl=zh-HK&gl=HK&ceid=HK:zh-Hant`
    : `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`

  const xml = await fetchRss(rssUrl)
  return parseFeed(xml)
}

function filterByAge(items: RawItem[], maxDays: number): RawItem[] {
  const oldestAllowed = Date.now() - maxDays * 24 * 60 * 60 * 1000

  return items.filter((item) => {
    const publishedTime = new Date(item.published_at).getTime()
    return !Number.isNaN(publishedTime) && publishedTime >= oldestAllowed
  })
}

async function translateEnglishTitles(items: NewsItem[]) {
  const indexes = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !hasChinese(item.title))

  if (indexes.length === 0) return items

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return items

  const titles = indexes.map(({ item }) => item.title)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `將以下新聞標題翻譯成繁體中文（香港風格），保留專有名詞。每行一個標題，直接返回翻譯，唔需要編號或解釋：\n${titles.join('\n')}`,
      }],
    }),
  })

  if (!response.ok) return items
  const data = await response.json().catch(() => ({}))
  const text = data.content?.find?.((part: { type?: string; text?: string }) => part.type === 'text')?.text
    || data.content?.[0]?.text
    || ''
  const translated = text.split('\n').map((line: string) => line.replace(/^[-\d.\s]+/, '').trim()).filter(Boolean)

  return items.map((item, itemIndex) => {
    const translationIndex = indexes.findIndex(({ index }) => index === itemIndex)
    if (translationIndex < 0 || !translated[translationIndex]) return item
    return {
      ...item,
      original_title: item.original_title || item.title,
      title: translated[translationIndex],
    }
  })
}

export async function fetchNewsForTrend(keywords: string, topic: string): Promise<NewsItem[]> {
  const keywordQuery = (keywords || topic || '').trim()
  const topicQuery = (topic || '').trim()
  const firstKeyword = (keywords || '')
    .split(',')
    .map((keyword) => keyword.trim())
    .find(Boolean)

  async function runTier(tier: number, query: string, maxDays: number, languages: Array<'zh' | 'en'>) {
    if (!query) return []

    const feeds = await Promise.allSettled(languages.map((lang) => fetchRSSItems(query, lang)))
    const results = filterByAge(
      feeds.flatMap((result) => result.status === 'fulfilled' ? result.value : []),
      maxDays
    )

    if (results.length >= 1) {
      console.log(`[fetchNews] Tier ${tier} succeeded: ${results.length} items for "${query}"`)
    }

    return results
  }

  const tiers: Array<{
    tier: number
    query: string
    maxDays: number
    languages: Array<'zh' | 'en'>
  }> = [
    { tier: 1, query: keywordQuery, maxDays: 7, languages: ['zh', 'en'] },
    { tier: 2, query: topicQuery, maxDays: 30, languages: ['zh', 'en'] },
    { tier: 3, query: firstKeyword || '', maxDays: 60, languages: ['zh'] },
  ]

  for (const tier of tiers) {
    const items = await runTier(tier.tier, tier.query, tier.maxDays, tier.languages)
    if (items.length >= 1) {
      const prepared = dedupeNews(items)
        .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
        .slice(0, 10)

      return translateEnglishTitles(prepared)
    }
  }

  return []
}
