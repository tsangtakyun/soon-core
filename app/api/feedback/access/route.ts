import { NextResponse } from 'next/server'

import { requireFeedbackActor } from '@/lib/feedback-auth'
import { cleanOptionalText } from '@/lib/feedback-contract'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const actor = await requireFeedbackActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: '只限管理員' }, { status: 403 })
  const admin = createSupabaseAdmin()
  const { data, error } = await admin.from('product_feedback_reporter_access').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ access: data ?? [] })
}

export async function POST(request: Request) {
  const actor = await requireFeedbackActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: '只限管理員' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const email = cleanOptionalText(body.email, 320)?.toLowerCase()
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: '請輸入有效電郵' }, { status: 400 })
  const accessScope = body.accessScope === 'core_member' ? 'core_member' : 'feedback_only'

  const admin = createSupabaseAdmin()
  const { data, error } = await admin.from('product_feedback_reporter_access').upsert({
    email,
    role: body.role === 'triage_admin' ? 'triage_admin' : 'reporter',
    access_scope: accessScope,
    status: 'active',
    invited_by: actor.userId,
  }, { onConflict: 'email' }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, access: data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const actor = await requireFeedbackActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: '只限管理員' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const id = cleanOptionalText(body.id, 64)
  const status = body.status === 'active' ? 'active' : body.status === 'revoked' ? 'revoked' : null
  if (!id || !status) return NextResponse.json({ error: '資料不完整' }, { status: 400 })
  const admin = createSupabaseAdmin()
  const { error } = await admin.from('product_feedback_reporter_access').update({ status }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
