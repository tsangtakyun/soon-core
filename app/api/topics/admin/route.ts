import { NextRequest, NextResponse } from 'next/server'

import { requireCoreAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import {
  cleanString,
  cleanStringArray,
  topicSelect,
  topicSlug,
  type TopicStatus,
} from '@/lib/topic-library'

export const runtime = 'nodejs'

const VALID_STATUSES = new Set<TopicStatus>(['draft', 'review', 'published', 'archived'])

function nullableDate(value: unknown) {
  const input = cleanString(value, 80)
  if (!input) return null
  const parsed = new Date(input)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function topicPayload(body: Record<string, unknown>, userId: string | null, currentStatus?: TopicStatus) {
  const status = VALID_STATUSES.has(body.status as TopicStatus) ? body.status as TopicStatus : currentStatus ?? 'draft'
  const publishedAt = status === 'published'
    ? nullableDate(body.published_at) ?? (currentStatus === 'published' ? undefined : new Date().toISOString())
    : nullableDate(body.published_at)

  return {
    slug: topicSlug(body.slug || body.title),
    title: cleanString(body.title, 180),
    summary: cleanString(body.summary, 1200),
    why_now: cleanString(body.why_now, 800),
    hook: cleanString(body.hook, 500),
    suggested_angles: cleanStringArray(body.suggested_angles, 10, 240),
    content_formats: cleanStringArray(body.content_formats, 10, 40),
    countries: cleanStringArray(body.countries, 10, 80),
    regions: cleanStringArray(body.regions, 20, 80),
    localities: cleanStringArray(body.localities, 20, 80),
    languages: cleanStringArray(body.languages, 10, 20).length
      ? cleanStringArray(body.languages, 10, 20)
      : ['zh-HK'],
    keywords: cleanStringArray(body.keywords, 30, 80),
    cover_url: cleanString(body.cover_url, 1000) || null,
    cover_alt: cleanString(body.cover_alt, 240) || null,
    status,
    published_at: publishedAt,
    expires_at: nullableDate(body.expires_at),
    updated_at: new Date().toISOString(),
    ...(userId ? { created_by: userId } : {}),
  }
}

function relationPayload(body: Record<string, unknown>) {
  const directionIds = cleanStringArray(body.direction_ids, 6, 80)
  const sources = Array.isArray(body.sources)
    ? body.sources
      .map((item) => {
        const source = item && typeof item === 'object' ? item as Record<string, unknown> : {}
        return {
          url: cleanString(source.url, 1000),
          source_name: cleanString(source.source_name, 160) || null,
          source_title: cleanString(source.source_title, 240) || null,
          published_at: nullableDate(source.published_at),
          notes: cleanString(source.notes, 500) || null,
        }
      })
      .filter((source) => source.url)
      .slice(0, 10)
    : []

  return { directionIds, sources }
}

async function replaceRelations(topicId: string, body: Record<string, unknown>) {
  const admin = createSupabaseAdmin()
  const { directionIds, sources } = relationPayload(body)

  const [{ error: directionDeleteError }, { error: sourceDeleteError }] = await Promise.all([
    admin.from('topic_item_directions').delete().eq('topic_id', topicId),
    admin.from('topic_sources').delete().eq('topic_id', topicId),
  ])
  if (directionDeleteError) throw directionDeleteError
  if (sourceDeleteError) throw sourceDeleteError

  const inserts = []
  if (directionIds.length) {
    inserts.push(admin.from('topic_item_directions').insert(directionIds.map((directionId, index) => ({
      topic_id: topicId,
      direction_id: directionId,
      is_primary: index === 0,
      confidence: null,
    }))))
  }
  if (sources.length) {
    inserts.push(admin.from('topic_sources').insert(sources.map((source) => ({ ...source, topic_id: topicId }))))
  }
  const results = await Promise.all(inserts)
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}

export async function GET() {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createSupabaseAdmin()
  const [{ data: topics, error: topicsError }, { data: directions, error: directionsError }] = await Promise.all([
    admin.from('topic_items').select(topicSelect()).order('updated_at', { ascending: false }),
    admin.from('topic_directions').select('*').eq('is_active', true).order('sort_order'),
  ])

  if (topicsError || directionsError) {
    return NextResponse.json({ error: topicsError?.message || directionsError?.message }, { status: 500 })
  }
  return NextResponse.json({ topics: topics ?? [], directions: directions ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const payload = topicPayload(body, auth.userId)
  if (!payload.title) return NextResponse.json({ error: '請輸入題材標題' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data, error } = await admin.from('topic_items').insert(payload).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    await replaceRelations(data.id, body)
    const { data: topic, error: readError } = await admin.from('topic_items').select(topicSelect()).eq('id', data.id).single()
    if (readError) throw readError
    return NextResponse.json({ topic }, { status: 201 })
  } catch (error) {
    await admin.from('topic_items').delete().eq('id', data.id)
    return NextResponse.json({ error: error instanceof Error ? error.message : '未能建立題材' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const id = cleanString(body.id, 80)
  if (!id) return NextResponse.json({ error: 'Missing topic id' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data: current, error: currentError } = await admin.from('topic_items').select('status').eq('id', id).single()
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 404 })

  const payload = topicPayload(body, null, current.status as TopicStatus)
  delete (payload as Partial<typeof payload>).created_by
  const { error } = await admin.from('topic_items').update(payload).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    await replaceRelations(id, body)
    const { data: topic, error: readError } = await admin.from('topic_items').select(topicSelect()).eq('id', id).single()
    if (readError) throw readError
    return NextResponse.json({ topic })
  } catch (relationError) {
    return NextResponse.json({ error: relationError instanceof Error ? relationError.message : '未能更新分類' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const id = request.nextUrl.searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'Missing topic id' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { error } = await admin.from('topic_items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
