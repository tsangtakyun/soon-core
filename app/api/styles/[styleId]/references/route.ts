import { NextResponse } from 'next/server'

import { bodyText, styleAdminContext } from '@/lib/style-admin'

export async function POST(request: Request, context: { params: Promise<{ styleId: string }> }) {
  const ctx = await styleAdminContext(); if ('error' in ctx) return ctx.error
  const { styleId } = await context.params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const type = bodyText(body.referenceType, 40), status = bodyText(body.confirmationStatus, 20) || 'suggested'
  const { data: style } = await ctx.admin.from('content_styles').select('id,scope').eq('id', styleId).eq('source_workspace_id', ctx.workspaceId).maybeSingle()
  if (!style) return NextResponse.json({ error: 'Style not found' }, { status: 404 })
  if (!['intelligence_inbox', 'content_direction', 'external'].includes(type) || !['suggested', 'review', 'confirmed', 'rejected'].includes(status)) return NextResponse.json({ error: 'Invalid reference type or status' }, { status: 400 })
  const inboxId = bodyText(body.intelligenceInboxItemId, 80) || null, docId = bodyText(body.contentDirectionDocId, 80) || null
  if (type === 'intelligence_inbox') {
    const { data } = await ctx.admin.from('intelligence_inbox_items').select('id').eq('id', inboxId).eq('workspace_id', ctx.workspaceId).maybeSingle()
    if (!data) return NextResponse.json({ error: 'Inbox reference not found in workspace' }, { status: 404 })
  }
  if (type === 'content_direction') {
    const { data } = await ctx.admin.from('docs').select('id').eq('id', docId).eq('workspace_id', ctx.workspaceId).eq('template_type', 'content_direction').maybeSingle()
    if (!data) return NextResponse.json({ error: 'Content direction not found in workspace' }, { status: 404 })
  }
  const sourceScope = bodyText(body.sourceScope, 30) || 'workspace_private'
  if (style.scope !== 'workspace_private' && status === 'confirmed' && sourceScope === 'workspace_private') return NextResponse.json({ error: 'Private evidence cannot confirm a shared style' }, { status: 409 })
  const row = { style_id: styleId, style_version_id: bodyText(body.styleVersionId, 80) || null, workspace_id: ctx.workspaceId,
    reference_type: type, intelligence_inbox_item_id: type === 'intelligence_inbox' ? inboxId : null,
    content_direction_doc_id: type === 'content_direction' ? docId : null, source_url: bodyText(body.sourceUrl, 1000) || null,
    source_account: bodyText(body.sourceAccount, 200) || null, extracted_patterns: typeof body.extractedPatterns === 'object' && body.extractedPatterns && !Array.isArray(body.extractedPatterns) ? body.extractedPatterns : {},
    evidence_summary: bodyText(body.evidenceSummary, 2000), evidence_level: bodyText(body.evidenceLevel, 20) || 'observed', confirmation_status: status,
    source_scope: sourceScope, confirmed_by: status === 'confirmed' ? ctx.userId : null, confirmed_at: status === 'confirmed' ? new Date().toISOString() : null, created_by: ctx.userId }
  const { data, error } = await ctx.admin.from('style_references').insert(row).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ reference: data }, { status: 201 })
}
