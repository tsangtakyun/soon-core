import { NextRequest, NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { cleanString, publicTopicSelect } from '@/lib/topic-library'

export const runtime = 'nodejs'

const ALLOWED_ORIGINS = new Set([
  'https://sooncreator.network',
  'https://www.sooncreator.network',
  'https://egg.sooncreator.network',
  'http://localhost:3000',
  'http://localhost:3001',
])

function headers(request: NextRequest) {
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
  return new NextResponse(null, { status: 204, headers: headers(request) })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params
  const slug = cleanString(rawSlug, 120)
  const now = new Date().toISOString()
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('topic_items')
    .select(publicTopicSelect())
    .eq('slug', slug)
    .eq('status', 'published')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .maybeSingle()

  if (error) return NextResponse.json({ error: '暫時未能載入題材' }, { status: 500, headers: headers(request) })
  if (!data) return NextResponse.json({ error: '找不到題材' }, { status: 404, headers: headers(request) })
  return NextResponse.json({ topic: data }, { headers: headers(request) })
}
