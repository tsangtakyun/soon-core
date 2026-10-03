import { NextRequest, NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { syncEggTopicsToCore } from '@/lib/egg-topic-sync'
import { cleanString, publicTopicSelect } from '@/lib/topic-library'

export const runtime = 'nodejs'

const ALLOWED_ORIGINS = new Set([
  'https://sooncreator.network',
  'https://www.sooncreator.network',
  'https://egg.sooncreator.network',
  'http://localhost:3000',
  'http://localhost:3001',
])

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin') ?? ''
  return {
    ...(ALLOWED_ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    Vary: 'Origin',
  }
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function GET(request: NextRequest) {
  const direction = cleanString(request.nextUrl.searchParams.get('direction'), 80)
  const region = cleanString(request.nextUrl.searchParams.get('region'), 80)
  const locality = cleanString(request.nextUrl.searchParams.get('locality'), 80)
  const language = cleanString(request.nextUrl.searchParams.get('language') || 'zh-HK', 20)
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 30, 1), 60)
  const now = new Date().toISOString()
  const admin = createSupabaseAdmin()
  try {
    await syncEggTopicsToCore()
  } catch (error) {
    console.error('EGG topic contribution sync failed', error)
  }

  let matchingTopicIds: string[] | null = null
  if (direction) {
    const { data: matches, error: matchError } = await admin
      .from('topic_item_directions')
      .select('topic_id')
      .eq('direction_id', direction)
    if (matchError) return NextResponse.json({ error: '暫時未能載入題材' }, { status: 500 })
    matchingTopicIds = (matches ?? []).map((item) => item.topic_id)
    if (matchingTopicIds.length === 0) {
      return NextResponse.json({
        topics: [],
        filters: { direction, region: region || null, locality: locality || null, language },
      }, { headers: corsHeaders(request) })
    }
  }

  let query = admin
    .from('topic_items')
    .select(publicTopicSelect())
    .eq('status', 'published')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .contains('languages', [language])
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (region) query = query.contains('regions', [region])
  if (locality) query = query.contains('localities', [locality])
  if (matchingTopicIds) query = query.in('id', matchingTopicIds)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: '暫時未能載入題材' }, { status: 500 })

  const topics = (data ?? []) as unknown as Array<Record<string, unknown> & { id: string }>
  const topicIds = topics.map((topic) => topic.id)
  const versions = new Map<string, number>()
  if (topicIds.length) {
    const { data: versionRows } = await admin
      .from('knowledge_asset_versions')
      .select('asset_id,version')
      .eq('asset_type', 'topic')
      .in('asset_id', topicIds)
      .order('version', { ascending: false })
    for (const row of versionRows ?? []) if (!versions.has(row.asset_id)) versions.set(row.asset_id, row.version)
  }

  return NextResponse.json({
    topics: topics.map((topic) => ({
      ...topic,
      knowledge_version: versions.get(topic.id) ?? null,
      knowledge_ref: versions.has(topic.id) ? `topic:${topic.id}:v${versions.get(topic.id)}` : null,
    })),
    filters: { direction: direction || null, region: region || null, locality: locality || null, language },
  }, { headers: corsHeaders(request) })
}
