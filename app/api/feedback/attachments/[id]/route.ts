import { NextResponse } from 'next/server'

import { requireFeedbackActor } from '@/lib/feedback-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireFeedbackActor()
  if (!actor) return NextResponse.json({ error: '未獲授權' }, { status: 403 })
  const { id } = await context.params
  const admin = createSupabaseAdmin()
  let query = admin
    .from('product_feedback_attachments')
    .select('storage_path,product_feedback_reports!inner(reporter_user_id)')
    .eq('id', id)
  if (!actor.isAdmin) query = query.eq('product_feedback_reports.reporter_user_id', actor.userId)
  const { data } = await query.maybeSingle()
  if (!data) return NextResponse.json({ error: '找不到附件' }, { status: 404 })

  const { data: signed, error } = await admin.storage.from('product-feedback-private').createSignedUrl(data.storage_path, 60)
  if (error || !signed?.signedUrl) return NextResponse.json({ error: '未能開啟附件' }, { status: 500 })
  return NextResponse.redirect(signed.signedUrl, { status: 302 })
}
