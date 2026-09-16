import { randomBytes } from 'node:crypto'

import { NextResponse } from 'next/server'

import { requireCoreAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { templateTokenHash } from '@/lib/template-master'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ code: string }> }) {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin || !auth.userId) return NextResponse.json({ error: '沒有管理權限' }, { status: 403 })
  const { code } = await context.params
  if (!/^[a-z][a-z0-9_]{2,79}$/.test(code)) return NextResponse.json({ error: 'Invalid style code' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data: style } = await admin.from('content_styles').select('id,code,name').eq('code', code).eq('status', 'active').maybeSingle()
  if (!style) return NextResponse.json({ error: '找不到已發布 Style' }, { status: 404 })
  const { data: styleVersion } = await admin.from('style_versions').select('id,version').eq('style_id', style.id).eq('status', 'published').order('version', { ascending: false }).limit(1).maybeSingle()
  if (!styleVersion) return NextResponse.json({ error: 'Style 尚未發布' }, { status: 409 })
  const { data: binding } = await admin.from('style_template_bindings').select('template_version_id').eq('style_version_id', styleVersion.id).eq('status', 'active').order('priority').limit(1).maybeSingle()
  if (!binding) return NextResponse.json({ error: '呢款 Style 尚未連接可編輯 Template' }, { status: 409 })
  const { data: baseVersion } = await admin.from('template_versions').select('id,template_id,version,renderer_code').eq('id', binding.template_version_id).eq('status', 'published').maybeSingle()
  if (!baseVersion) return NextResponse.json({ error: '找不到已發布 Template version' }, { status: 409 })

  const token = randomBytes(32).toString('base64url')
  const { data: existing } = await admin.from('template_master_drafts').select('id,target_version,status').eq('template_id', baseVersion.template_id).in('status', ['draft','review']).order('updated_at', { ascending: false }).limit(1).maybeSingle()
  let draft = existing
  if (existing) {
    const { data, error } = await admin.from('template_master_drafts').update({ edit_token_hash: templateTokenHash(token), updated_at: new Date().toISOString() }).eq('id', existing.id).select('id,target_version,status').single()
    if (error) throw error
    draft = data
  } else {
    const { data: latest } = await admin.from('template_versions').select('version').eq('template_id', baseVersion.template_id).order('version', { ascending: false }).limit(1).maybeSingle()
    const { data, error } = await admin.from('template_master_drafts').insert({
      template_id: baseVersion.template_id,
      base_template_version_id: baseVersion.id,
      style_id: style.id,
      style_version_id: styleVersion.id,
      target_version: Number(latest?.version || 0) + 1,
      change_summary: `Master template refinement for ${style.name}.`,
      edit_token_hash: templateTokenHash(token),
      created_by: auth.userId,
    }).select('id,target_version,status').single()
    if (error) throw error
    draft = data
  }
  const editUrl = `/content-directions/styles/${encodeURIComponent(style.code)}/template-editor?draft=${encodeURIComponent(draft!.id)}`
  return NextResponse.json({ draft, editUrl })
}
