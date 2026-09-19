import { NextResponse } from 'next/server'

import { canReadFeedbackReport, requireFeedbackActor } from '@/lib/feedback-auth'
import { cleanOptionalText, isFeedbackStatus } from '@/lib/feedback-contract'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireFeedbackActor()
  if (!actor) return NextResponse.json({ error: '未獲授權' }, { status: 403 })
  const { id } = await context.params
  if (!(await canReadFeedbackReport(id, actor))) return NextResponse.json({ error: '找不到回報' }, { status: 404 })

  const admin = createSupabaseAdmin()
  const [{ data: report, error }, { data: attachments }, { data: messages }, { data: history }] = await Promise.all([
    admin.from('product_feedback_reports').select('*').eq('id', id).single(),
    admin.from('product_feedback_attachments').select('id,kind,original_filename,mime_type,size_bytes,created_at').eq('report_id', id).order('created_at'),
    admin.from('product_feedback_messages').select('id,author_email,author_role,body,created_at').eq('report_id', id).order('created_at'),
    admin.from('product_feedback_status_history').select('id,from_status,to_status,changed_by_email,note,created_at').eq('report_id', id).order('created_at'),
  ])
  if (error || !report) return NextResponse.json({ error: error?.message ?? '找不到回報' }, { status: 404 })
  return NextResponse.json({
    actor,
    report,
    attachments: (attachments ?? []).map((item) => ({ ...item, downloadUrl: `/api/feedback/attachments/${item.id}` })),
    messages: messages ?? [],
    history: history ?? [],
  })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireFeedbackActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: '只限管理員更新進度' }, { status: 403 })
  const { id } = await context.params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const status = body.status
  if (status !== undefined && !isFeedbackStatus(status)) return NextResponse.json({ error: '無效狀態' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data: current } = await admin.from('product_feedback_reports').select('status').eq('id', id).maybeSingle()
  if (!current) return NextResponse.json({ error: '找不到回報' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (status !== undefined) {
    updates.status = status
    updates.resolved_at = status === 'resolved' ? new Date().toISOString() : null
  }
  if ('assignedToEmail' in body) updates.assigned_to_email = cleanOptionalText(body.assignedToEmail, 320)
  if (!Object.keys(updates).length) return NextResponse.json({ error: '沒有更新內容' }, { status: 400 })

  const { error } = await admin.from('product_feedback_reports').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (status !== undefined && status !== current.status) {
    await admin.from('product_feedback_status_history').insert({
      report_id: id,
      from_status: current.status,
      to_status: status,
      changed_by_user_id: actor.userId,
      changed_by_email: actor.email,
      note: cleanOptionalText(body.note, 1000),
    })
  }
  return NextResponse.json({ ok: true })
}
