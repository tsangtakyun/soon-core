import { NextResponse } from 'next/server'

import { bodyText, styleAdminContext } from '@/lib/style-admin'

export async function PATCH(request: Request, context: { params: Promise<{ styleId: string; version: string }> }) {
  const ctx = await styleAdminContext(); if ('error' in ctx) return ctx.error
  const { styleId, version: rawVersion } = await context.params
  const version = Number(rawVersion)
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const status = bodyText(body.status, 20)
  if (!Number.isInteger(version) || !['draft', 'review', 'published'].includes(status)) return NextResponse.json({ error: 'Invalid version or status' }, { status: 400 })
  const { data: style } = await ctx.admin.from('content_styles').select('id').eq('id', styleId).eq('source_workspace_id', ctx.workspaceId).maybeSingle()
  if (!style) return NextResponse.json({ error: 'Style not found' }, { status: 404 })
  const patch: Record<string, unknown> = { status }
  if (status === 'review') patch.reviewed_by = ctx.userId
  if (status === 'published') patch.published_by = ctx.userId
  if (body.rules && typeof body.rules === 'object' && !Array.isArray(body.rules)) patch.rules = body.rules
  if (body.changeSummary) patch.change_summary = bodyText(body.changeSummary, 1000)
  const { data, error } = await ctx.admin.from('style_versions').update(patch).eq('style_id', styleId).eq('version', version).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  if (!data) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  return NextResponse.json({ version: data })
}
