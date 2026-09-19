import { NextResponse } from 'next/server'

import { canReadFeedbackReport, requireFeedbackActor } from '@/lib/feedback-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireFeedbackActor()
  if (!actor) return NextResponse.json({ error: '未獲授權' }, { status: 403 })
  const { id } = await context.params
  if (!(await canReadFeedbackReport(id, actor))) return NextResponse.json({ error: '找不到回報' }, { status: 404 })

  const payload = await request.json().catch(() => ({})) as { body?: unknown }
  const body = typeof payload.body === 'string' ? payload.body.trim() : ''
  if (!body || body.length > 4000) return NextResponse.json({ error: '補充內容需要 1 至 4000 字' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data, error } = await admin.from('product_feedback_messages').insert({
    report_id: id,
    author_user_id: actor.userId,
    author_email: actor.email,
    author_role: actor.isAdmin ? 'admin' : 'reporter',
    body,
  }).select('id,author_email,author_role,body,created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, message: data }, { status: 201 })
}
