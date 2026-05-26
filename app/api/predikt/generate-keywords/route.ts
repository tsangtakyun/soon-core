import { NextRequest, NextResponse } from 'next/server'

import { createSupabaseRouteClient } from '@/lib/supabase-route'

export const runtime = 'nodejs'
export const maxDuration = 60

const ADMIN_EMAILS = [
  'tsangtakyun@gmail.com',
]

async function requireAdmin() {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return ADMIN_EMAILS.includes(session?.user?.email ?? '')
}

export async function POST(request: NextRequest) {
  const isAdmin = await requireAdmin()
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const body = await request.json().catch(() => ({})) as { topic?: string; description?: string }
    const topic = (body.topic || '').trim()
    const description = (body.description || '').trim()
    if (!topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: `根據以下話題，生成5-8個最適合用嚟搜尋相關新聞嘅關鍵字，包括中文同英文。
話題：${topic}
描述：${description}

只需返回關鍵字，用逗號分隔，例如：2026世界盃, FIFA World Cup, 香港球迷, HK football
唔需要任何解釋。`,
        }],
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error?.message || 'AI keyword generation failed')
    const keywords = data.content?.find?.((part: { type?: string; text?: string }) => part.type === 'text')?.text
      || data.content?.[0]?.text
      || ''

    return NextResponse.json({ keywords: keywords.replace(/\n+/g, ', ').trim() })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'AI keyword generation failed',
    }, { status: 500 })
  }
}
