import { NextResponse } from 'next/server'

import { authorisedStyleReader } from '@/lib/style-registry'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { safePageRole, validTemplateToken } from '@/lib/template-master'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function loadDraft(id: string) {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin.from('template_master_drafts').select('id,template_id,base_template_version_id,style_id,style_version_id,target_version,status,page_designs,change_summary,edit_token_hash,updated_at').eq('id', id).maybeSingle()
  if (error) throw error
  return { admin, draft: data }
}

function allowed(request: Request, expectedHash: string) {
  return authorisedStyleReader(request) && validTemplateToken(request.headers.get('x-soon-template-token'), expectedHash)
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { admin, draft } = await loadDraft(id)
  if (!draft) return NextResponse.json({ error: 'Template draft not found' }, { status: 404 })
  if (!allowed(request, draft.edit_token_hash)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [{ data: template }, { data: baseVersion }, { data: style }] = await Promise.all([
    admin.from('content_templates').select('code,name,description,format').eq('id', draft.template_id).single(),
    admin.from('template_versions').select('version,renderer_code,contract,content_hash').eq('id', draft.base_template_version_id).single(),
    admin.from('content_styles').select('code,name').eq('id', draft.style_id).single(),
  ])
  return NextResponse.json({
    draft: { id: draft.id, targetVersion: draft.target_version, status: draft.status, pageDesigns: draft.page_designs, changeSummary: draft.change_summary, updatedAt: draft.updated_at },
    template,
    style,
    baseVersion: baseVersion ? { number: baseVersion.version, rendererCode: baseVersion.renderer_code, contract: baseVersion.contract, contentHash: baseVersion.content_hash } : null,
  })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { admin, draft } = await loadDraft(id)
  if (!draft) return NextResponse.json({ error: 'Template draft not found' }, { status: 404 })
  if (!allowed(request, draft.edit_token_hash)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (draft.status === 'published' || draft.status === 'abandoned') return NextResponse.json({ error: 'Template draft is closed' }, { status: 409 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const role = safePageRole(body.pageRole)
  const canvasJson = body.canvasJson && typeof body.canvasJson === 'object' && !Array.isArray(body.canvasJson) ? body.canvasJson : null
  if (!role || !canvasJson) return NextResponse.json({ error: 'Missing master page design' }, { status: 400 })
  const pageDesigns = draft.page_designs && typeof draft.page_designs === 'object' ? draft.page_designs as Record<string, unknown> : {}
  const nextPageDesigns = { ...pageDesigns, [role]: {
    canvasJson,
    canvasWidth: Math.max(100, Math.round(Number(body.canvasWidth) || 1080)),
    canvasHeight: Math.max(100, Math.round(Number(body.canvasHeight) || 1350)),
    previewImageUrl: typeof body.previewImageUrl === 'string' ? body.previewImageUrl.slice(0, 1500) : '',
    updatedAt: new Date().toISOString(),
  } }
  const { data, error } = await admin.from('template_master_drafts').update({ page_designs: nextPageDesigns, status: 'review', updated_at: new Date().toISOString() }).eq('id', id).select('id,target_version,status,page_designs,updated_at').single()
  if (error) throw error
  return NextResponse.json({ draft: data })
}
