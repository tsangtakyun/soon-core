import { NextResponse } from 'next/server'

import { bodyText, styleAdminContext } from '@/lib/style-admin'

export async function POST(request: Request, context: { params: Promise<{ styleId: string }> }) {
  const ctx = await styleAdminContext(); if ('error' in ctx) return ctx.error
  const { styleId } = await context.params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const rules = body.rules
  if (!rules || typeof rules !== 'object' || Array.isArray(rules) || !bodyText(body.changeSummary, 1000)) return NextResponse.json({ error: 'Rules and changeSummary are required' }, { status: 400 })
  const { data: style } = await ctx.admin.from('content_styles').select('id,format').eq('id', styleId).eq('source_workspace_id', ctx.workspaceId).maybeSingle()
  if (!style) return NextResponse.json({ error: 'Style not found' }, { status: 404 })
  if ((rules as Record<string, unknown>).format !== style.format || typeof (rules as Record<string, unknown>).schema_version !== 'number') return NextResponse.json({ error: 'Rules must contain matching format and numeric schema_version' }, { status: 400 })
  const { data: current } = await ctx.admin.from('style_versions').select('version').eq('style_id', styleId).order('version', { ascending: false }).limit(1).maybeSingle()
  const { data, error } = await ctx.admin.from('style_versions').insert({ style_id: styleId, version: (current?.version ?? 0) + 1, rules, change_summary: bodyText(body.changeSummary, 1000), status: 'draft', created_by: ctx.userId }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ version: data }, { status: 201 })
}
