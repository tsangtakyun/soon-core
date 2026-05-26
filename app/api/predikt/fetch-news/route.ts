import { NextRequest, NextResponse } from 'next/server'

import { createSupabaseRouteClient } from '@/lib/supabase-route'

const ADMIN_EMAILS = [
  'tsangtakyun@gmail.com',
]

type NewsItem = {
  title: string
  source: string
  url: string
  published_at: string | null
}

async function requireAdmin() {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return ADMIN_EMAILS.includes(session?.user?.email ?? '')
}

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)))
    .trim()
}

function tagValue(itemXml: string, tag: string) {
  const match = itemXml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? decodeHtml(match[1]) : ''
}

function sourceValue(itemXml: string) {
  const match = itemXml.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i)
  return match ? decodeHtml(match[1]) : ''
}

function cleanTitle(title: string, source: string) {
  if (!source) return title
  return title.replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '').trim()
}

function parseGoogleNews(xml: string): NewsItem[] {
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []
  return itemMatches.slice(0, 8).map((itemXml) => {
    const source = sourceValue(itemXml)
    const title = cleanTitle(tagValue(itemXml, 'title'), source)
    const published = tagValue(itemXml, 'pubDate')
    const publishedDate = published ? new Date(published) : null

    return {
      title,
      source,
      url: tagValue(itemXml, 'link'),
      published_at: publishedDate && !Number.isNaN(publishedDate.getTime()) ? publishedDate.toISOString() : null,
    }
  }).filter((item) => item.title && item.url)
}

export async function POST(request: NextRequest) {
  const isAdmin = await requireAdmin()
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized', items: [] }, { status: 403 })

  try {
    const body = await request.json().catch(() => ({})) as { keywords?: string; topic?: string }
    const query = encodeURIComponent((body.keywords || body.topic || '').trim())
    if (!query) return NextResponse.json({ error: 'Missing keywords', items: [] }, { status: 400 })

    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=zh-HK&gl=HK&ceid=HK:zh-Hant`
    const response = await fetch(rssUrl, { headers: { 'User-Agent': 'SOON-Core/1.0' } })
    if (!response.ok) throw new Error(`Google News RSS returned ${response.status}`)

    const xml = await response.text()
    return NextResponse.json({ items: parseGoogleNews(xml) })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'News fetch failed',
      items: [],
    }, { status: 500 })
  }
}
