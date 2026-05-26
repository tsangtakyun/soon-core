import { NextRequest, NextResponse } from 'next/server'

import { fetchNewsForTrend } from '@/lib/predikt/fetchNews'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const maxDuration = 300

type TrendRow = {
  id: string
  topic: string
  keywords: string | null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization') || ''
  if (!expected || authorization !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized', updated: 0, errors: [] }, { status: 401 })
  }

  const errors: string[] = []
  let updated = 0

  try {
    const supabase = createSupabaseAdmin()
    const { data: trends, error } = await supabase
      .from('trends')
      .select('id, topic, keywords')
      .eq('is_active', true)
      .not('keywords', 'is', null)

    if (error) throw error

    for (const trend of (trends ?? []) as TrendRow[]) {
      try {
        if (!trend.keywords?.trim()) continue
        const news = await fetchNewsForTrend(trend.keywords, trend.topic)
        const { error: updateError } = await supabase
          .from('trends')
          .update({ news_headlines: news })
          .eq('id', trend.id)

        if (updateError) throw updateError
        updated += 1
        await sleep(200)
      } catch (trendError) {
        errors.push(`${trend.topic}: ${trendError instanceof Error ? trendError.message : 'unknown error'}`)
      }
    }

    return NextResponse.json({ updated, errors })
  } catch (error) {
    return NextResponse.json({
      updated,
      errors: [...errors, error instanceof Error ? error.message : 'Cron update failed'],
    }, { status: 500 })
  }
}
