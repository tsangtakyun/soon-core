import { NextRequest, NextResponse } from 'next/server'

import { fetchNewsForTrend } from '@/lib/predikt/fetchNews'
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
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized', items: [] }, { status: 403 })

  try {
    const body = await request.json().catch(() => ({})) as { keywords?: string; topic?: string }
    const items = await fetchNewsForTrend(body.keywords || '', body.topic || '')
    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'News fetch failed',
      items: [],
    }, { status: 500 })
  }
}
