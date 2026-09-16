import { NextResponse } from 'next/server'

import { requireCoreAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin || !auth.userId) return NextResponse.json({ error: '沒有管理權限' }, { status: 403 })
  const { id } = await context.params
  const admin = createSupabaseAdmin()
  const { data: draft, error: draftError } = await admin.from('template_master_drafts')
    .select('id,template_id,base_template_version_id,style_version_id,target_version,status,page_designs,change_summary')
    .eq('id', id).maybeSingle()
  if (draftError) throw draftError
  if (!draft) return NextResponse.json({ error: '找不到 Template draft' }, { status: 404 })
  if (draft.status !== 'review') return NextResponse.json({ error: 'Draft 尚未提交審閱' }, { status: 409 })

  const { data: baseVersion, error: baseError } = await admin.from('template_versions')
    .select('renderer_code,contract,creator_commit').eq('id', draft.base_template_version_id).single()
  if (baseError) throw baseError
  const contract = baseVersion.contract && typeof baseVersion.contract === 'object' ? baseVersion.contract as Record<string, unknown> : {}
  const pageRoles = Array.isArray(contract.page_roles)
    ? contract.page_roles.flatMap((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>).role === 'string' ? [String((item as Record<string, unknown>).role)] : [])
    : []
  const pageDesigns = draft.page_designs && typeof draft.page_designs === 'object' ? draft.page_designs as Record<string, unknown> : {}
  const missing = pageRoles.filter((role) => !pageDesigns[role])
  if (missing.length) return NextResponse.json({ error: `請先完成所有標準頁：${missing.join('、')}`, missing }, { status: 409 })

  const rendererBase = baseVersion.renderer_code.replace(/-v\d+$/, '')
  const rendererCode = `${rendererBase}-v${draft.target_version}`
  const nextContract = { ...contract, master_designs: pageDesigns, master_editor: { source: 'soon_creator_fabric', publishedFromDraftId: draft.id } }
  const { data: version, error: insertError } = await admin.from('template_versions').insert({
    template_id: draft.template_id,
    version: draft.target_version,
    renderer_code: rendererCode,
    contract: nextContract,
    change_summary: draft.change_summary || `Published master template v${draft.target_version}.`,
    status: 'draft',
    content_hash: '',
    creator_commit: baseVersion.creator_commit,
    created_by: auth.userId,
  }).select('id,version').single()
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 409 })
  const { error: reviewError } = await admin.from('template_versions').update({ status: 'review', reviewed_by: auth.userId }).eq('id', version.id)
  if (reviewError) throw reviewError
  const { error: publishError } = await admin.from('template_versions').update({ status: 'published', published_by: auth.userId }).eq('id', version.id)
  if (publishError) throw publishError
  const { error: deprecateError } = await admin.from('style_template_bindings').update({ status: 'deprecated' }).eq('style_version_id', draft.style_version_id).eq('status', 'active')
  if (deprecateError) throw deprecateError
  const { error: bindingError } = await admin.from('style_template_bindings').insert({ style_version_id: draft.style_version_id, template_version_id: version.id, status: 'active', priority: 5 })
  if (bindingError) throw bindingError
  const { error: completeError } = await admin.from('template_master_drafts').update({ status: 'published', published_template_version_id: version.id, published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', draft.id)
  if (completeError) throw completeError
  return NextResponse.json({ published: true, templateVersion: version.version, rendererCode })
}
