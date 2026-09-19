import { after, NextResponse } from 'next/server'

import { canReadFeedbackReport, requireFeedbackActor } from '@/lib/feedback-auth'
import { triageFeedbackReport } from '@/lib/feedback-triage'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireFeedbackActor()
  if (!actor) return NextResponse.json({ error: '未獲授權' }, { status: 403 })
  const { id } = await context.params
  if (!(await canReadFeedbackReport(id, actor))) return NextResponse.json({ error: '找不到回報' }, { status: 404 })
  const body = await request.json().catch(() => ({})) as { force?: unknown }
  const retryableStatuses = body.force === true
    ? ['queued', 'failed', 'not_configured']
    : ['failed', 'not_configured']

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('product_feedback_reports')
    .update({ ai_status: 'queued', ai_error: null })
    .eq('id', id)
    .in('ai_status', retryableStatuses)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'AI 分析目前不需要重試' }, { status: 409 })

  after(() => triageFeedbackReport(id))
  return NextResponse.json({ ok: true, aiStatus: 'queued' })
}
