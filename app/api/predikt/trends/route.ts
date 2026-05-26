import { NextRequest, NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

const ADMIN_EMAILS = [
  'tsangtakyun@gmail.com',
]

async function requireAdmin() {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const email = session?.user?.email ?? ''
  return {
    ok: ADMIN_EMAILS.includes(email),
    email,
  }
}

function clampScore(value: unknown) {
  const number = Number(value)
  if (Number.isNaN(number)) return 0
  return Math.max(0, Math.min(100, number))
}

function zonedLocalTimeToUtc(value: string, timeZone: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return null

  const [, year, month, day, hour, minute] = match
  const utcGuess = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  const parts = new Intl.DateTimeFormat('en-CA', {
    calendar: 'iso8601',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(new Date(utcGuess))

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second || 0)
  )
  return new Date(utcGuess - (zonedAsUtc - utcGuess)).toISOString()
}

function normaliseDeadline(value: unknown, timeZone: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const timezone = normaliseTimezone(timeZone)
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(value.trim())) {
    const zonedValue = zonedLocalTimeToUtc(value.trim(), timezone)
    if (zonedValue) return zonedValue
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normaliseTimezone(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'Asia/Hong_Kong'
}

function trendPayload(body: Record<string, unknown>) {
  return {
    icon: typeof body.icon === 'string' && body.icon.trim() ? body.icon.trim() : '💬',
    topic: typeof body.topic === 'string' ? body.topic.trim() : '',
    category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'news',
    keywords: typeof body.keywords === 'string' && body.keywords.trim() ? body.keywords.trim() : null,
    heat_score: clampScore(body.heat_score),
    is_active: Boolean(body.is_active),
    angles: Array.isArray(body.angles) ? body.angles : [],
    deadline_at: normaliseDeadline(body.deadline_at, body.deadline_timezone),
    deadline_timezone: normaliseTimezone(body.deadline_timezone),
    news_headlines: Array.isArray(body.news_headlines) ? body.news_headlines : [],
    description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null,
    why_trending: typeof body.why_trending === 'string' && body.why_trending.trim() ? body.why_trending.trim() : null,
    creator_tips: typeof body.creator_tips === 'string' && body.creator_tips.trim() ? body.creator_tips.trim() : null,
    related_links: Array.isArray(body.related_links) ? body.related_links : [],
  }
}

export async function GET() {
  const adminCheck = await requireAdmin()
  if (!adminCheck.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('trends')
    .select('*')
    .order('heat_score', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ trends: data ?? [] })
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin()
  if (!adminCheck.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const payload = trendPayload(body)
  if (!payload.topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('trends')
    .insert(payload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ trend: data })
}

export async function PATCH(request: NextRequest) {
  const adminCheck = await requireAdmin()
  if (!adminCheck.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'Missing trend id' }, { status: 400 })

  const allowedUpdates: Record<string, unknown> = {}
  if ('icon' in body) allowedUpdates.icon = typeof body.icon === 'string' && body.icon.trim() ? body.icon.trim() : '💬'
  if ('topic' in body) allowedUpdates.topic = typeof body.topic === 'string' ? body.topic.trim() : ''
  if ('category' in body) allowedUpdates.category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'news'
  if ('keywords' in body) allowedUpdates.keywords = typeof body.keywords === 'string' && body.keywords.trim() ? body.keywords.trim() : null
  if ('heat_score' in body) allowedUpdates.heat_score = clampScore(body.heat_score)
  if ('is_active' in body) allowedUpdates.is_active = Boolean(body.is_active)
  if ('angles' in body) allowedUpdates.angles = Array.isArray(body.angles) ? body.angles : []
  if ('deadline_at' in body) {
    allowedUpdates.deadline_at = normaliseDeadline(body.deadline_at, body.deadline_timezone)
  }
  if ('deadline_timezone' in body) allowedUpdates.deadline_timezone = normaliseTimezone(body.deadline_timezone)
  if ('news_headlines' in body) allowedUpdates.news_headlines = Array.isArray(body.news_headlines) ? body.news_headlines : []
  if ('description' in body) allowedUpdates.description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null
  if ('why_trending' in body) allowedUpdates.why_trending = typeof body.why_trending === 'string' && body.why_trending.trim() ? body.why_trending.trim() : null
  if ('creator_tips' in body) allowedUpdates.creator_tips = typeof body.creator_tips === 'string' && body.creator_tips.trim() ? body.creator_tips.trim() : null
  if ('related_links' in body) allowedUpdates.related_links = Array.isArray(body.related_links) ? body.related_links : []

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('trends')
    .update(allowedUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ trend: data })
}

export async function DELETE(request: NextRequest) {
  const adminCheck = await requireAdmin()
  if (!adminCheck.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const id = request.nextUrl.searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'Missing trend id' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('trends')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
