import { NextResponse } from 'next/server'

import { bodyText, styleAdminContext } from '@/lib/style-admin'
import { isStyleFormat } from '@/lib/style-registry'

const CANONICAL_WORKSPACE = 'a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'

export async function GET() {
  const ctx = await styleAdminContext(); if ('error' in ctx) return ctx.error
  const { data, error } = await ctx.admin.from('content_styles').select('*,style_versions(id,version,status,content_hash,change_summary,published_at,updated_at)').eq('source_workspace_id', ctx.workspaceId).order('code')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ styles: data ?? [] })
}

export async function POST(request: Request) {
  const ctx = await styleAdminContext(); if ('error' in ctx) return ctx.error
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const code = bodyText(body.code, 80), format = bodyText(body.format, 40), name = bodyText(body.name, 160)
  const requestedScope = bodyText(body.scope, 40)
  const scope = ctx.workspaceId === CANONICAL_WORKSPACE && ['public_research', 'soon_owned'].includes(requestedScope) ? requestedScope : 'workspace_private'
  if (!/^[a-z][a-z0-9_]{2,79}$/.test(code) || !isStyleFormat(format) || !name) return NextResponse.json({ error: 'Invalid code, format or name' }, { status: 400 })
  const { data, error } = await ctx.admin.from('content_styles').insert({ code, format, name, description: bodyText(body.description), status: 'active', scope, source_workspace_id: ctx.workspaceId, created_by: ctx.userId }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '23505' ? 409 : 500 })
  return NextResponse.json({ style: data }, { status: 201 })
}
