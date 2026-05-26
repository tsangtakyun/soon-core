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
  for (const item of items) {
    if (!deduped.some((existing) => isSimilarTitle(existing.original_title || existing.title, item.original_title || item.title))) {
      deduped.push(item)
    }
  }
  return deduped
}

function getFeedItems(xml: string): RssItem[] {
  const parsed = parser.parse(xml)
  const items = parsed?.rss?.channel?.item ?? []
  return Array.isArray(items) ? items : [items]
}

function parseFeed(xml: string): NewsItem[] {
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
  const queryText = (keywords || topic || '').trim()
  if (!queryText) return []

  const query = encodeURIComponent(queryText)
  const rssZH = `https://news.google.com/rss/search?q=${query}&hl=zh-HK&gl=HK&ceid=HK:zh-Hant`
  const rssEN = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  const feeds = await Promise.allSettled([fetchRss(rssZH), fetchRss(rssEN)])
  const items = feeds
    .flatMap((result) => result.status === 'fulfilled' ? parseFeed(result.value) : [])
    .filter((item) => new Date(item.published_at).getTime() >= sevenDaysAgo)
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())

  return translateEnglishTitles(dedupeNews(items).slice(0, 10))
}
