import { NextRequest, NextResponse } from 'next/server'

import { requireCoreAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { cleanString } from '@/lib/topic-library'

export const runtime = 'nodejs'
export const maxDuration = 60

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    const hostname = url.hostname.toLowerCase()
    if (
      hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '::1' ||
      hostname.endsWith('.local') || /^127\./.test(hostname) || /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) || /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) return null
    return url
  } catch {
    return null
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14000)
}

function parseJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI 未有返回有效資料')
  return JSON.parse(match[0]) as Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const sourceUrl = cleanString(body.source_url, 1000)
  const sourceText = cleanString(body.source_text, 14000)
  const existingTitle = cleanString(body.title, 180)
  if (!sourceUrl && !sourceText && !existingTitle) {
    return NextResponse.json({ error: '請先輸入來源網址、原始資料或題材標題' }, { status: 400 })
  }

  let extractedText = sourceText
  if (!extractedText && sourceUrl) {
    const url = safeExternalUrl(sourceUrl)
    if (!url) return NextResponse.json({ error: '來源網址不支援' }, { status: 400 })
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'SOON-Topic-Editor/1.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      })
      if (response.ok) extractedText = stripHtml((await response.text()).slice(0, 250000))
    } catch {
      // The URL remains a citation even when the publisher blocks automated reading.
    }
  }

  const admin = createSupabaseAdmin()
  const { data: directions, error: directionsError } = await admin
    .from('topic_directions')
    .select('id,label_zh,aliases')
    .eq('is_active', true)
    .order('sort_order')
  if (directionsError) return NextResponse.json({ error: directionsError.message }, { status: 500 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 尚未設定' }, { status: 500 })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 1800,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: [
          '你係 SOON.AI 題材編輯助理。將來源整理成繁體中文（香港用語）的原創題材卡初稿。',
          '只整理可由資料支持的內容，不可虛構。分類只可從提供的 direction id 選最多3個。',
          `分類字典：${JSON.stringify(directions)}`,
          `現有標題：${existingTitle || '未有'}`,
          `來源網址：${sourceUrl || '未有'}`,
          `來源內容：${extractedText || '網站未能自動讀取，請只根據標題及網址做保守建議'}`,
          '只返回 JSON：',
          JSON.stringify({
            title: '簡潔題材標題',
            summary: '2至3句資料摘要',
            why_now: '為何現在值得做',
            hook: '一條內容開場問題或反差句',
            suggested_angles: ['角度一', '角度二'],
            direction_ids: ['direction-id'],
            countries: ['Taiwan'],
            regions: ['Tainan'],
            localities: ['Anping'],
            keywords: ['關鍵字'],
            content_formats: ['carousel', 'short_video'],
          }),
        ].join('\n\n'),
      }],
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return NextResponse.json({ error: data?.error?.message || 'AI 整理失敗' }, { status: response.status })
  }
  const text = data.content?.find?.((part: { type?: string; text?: string }) => part.type === 'text')?.text || ''

  try {
    return NextResponse.json({ suggestion: parseJson(text), source_read: Boolean(extractedText) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'AI 整理失敗' }, { status: 502 })
  }
}
