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

function trendPayload(body: Record<string, unknown>) {
  return {
    icon: typeof body.icon === 'string' && body.icon.trim() ? body.icon.trim() : '💬',
    topic: typeof body.topic === 'string' ? body.topic.trim() : '',
    heat_score: clampScore(body.heat_score),
    is_active: Boolean(body.is_active),
    angles: Array.isArray(body.angles) ? body.angles : [],
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
  if ('heat_score' in body) allowedUpdates.heat_score = clampScore(body.heat_score)
  if ('is_active' in body) allowedUpdates.is_active = Boolean(body.is_active)
  if ('angles' in body) allowedUpdates.angles = Array.isArray(body.angles) ? body.angles : []

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
