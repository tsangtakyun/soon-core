import { NextResponse } from 'next/server'

import { requireCoreAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

type JsonRecord = Record<string, unknown>
const text = (value: unknown, max = 2000) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const list = (value: unknown, max = 20) => Array.isArray(value) ? value.map((item) => text(item, 160)).filter(Boolean).slice(0, max) : []
const number = (value: unknown) => value === '' || value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value)

function normalize(value: JsonRecord) {
  const kind = text(value.kind, 40) === 'moment' ? 'moment' : 'evergreen'
  return {
    title: text(value.title, 200), account: text(value.account, 160), platform: text(value.platform, 60) || 'Instagram',
    postUrl: text(value.postUrl, 1000), imageUrl: text(value.imageUrl, 1000), capturedAt: text(value.capturedAt, 40) || new Date().toISOString().slice(0, 10), publishedAt: text(value.publishedAt, 40),
    kind, eventName: kind === 'moment' ? text(value.eventName, 200) : '', eventDate: kind === 'moment' ? text(value.eventDate, 40) : '',
    trendStage: text(value.trendStage, 60), trendDependency: text(value.trendDependency, 40), reusableWindow: text(value.reusableWindow, 80), responseSpeed: text(value.responseSpeed, 100),
    hook: text(value.hook, 1000), format: text(value.format, 160), visualPattern: text(value.visualPattern, 1200), tone: text(value.tone, 300), cta: text(value.cta, 500),
    mechanism: text(value.mechanism, 1600), whySave: text(value.whySave, 1600), reusableTemplate: text(value.reusableTemplate, 2000),
    industries: list(value.industries), objectives: list(value.objectives), tags: list(value.tags), risks: text(value.risks, 1600),
    metrics: {
      likes: number((value.metrics as JsonRecord)?.likes), comments: number((value.metrics as JsonRecord)?.comments),
      shares: number((value.metrics as JsonRecord)?.shares), reposts: number((value.metrics as JsonRecord)?.reposts), views: number((value.metrics as JsonRecord)?.views),
    },
    metricsCapturedAt: text(value.metricsCapturedAt, 40) || text(value.capturedAt, 40) || new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
  }
}

async function context() {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin || !auth.userId) return { error: NextResponse.json({ error: '沒有管理權限' }, { status: 403 }) }
  const admin = createSupabaseAdmin()
  const { data: membership } = await admin.from('workspace_members').select('workspace_id').eq('user_id', auth.userId).eq('status', 'active').limit(1).maybeSingle()
  if (!membership?.workspace_id) return { error: NextResponse.json({ error: '找不到可用工作區' }, { status: 400 }) }
  return { admin, workspaceId: membership.workspace_id }
}

function parseDoc(doc: JsonRecord) {
  let item: JsonRecord = {}
  try { item = typeof doc.content === 'string' ? JSON.parse(doc.content) : (doc.content as JsonRecord) || {} } catch {}
  return { id: doc.id, createdAt: doc.created_at, updatedAt: doc.updated_at || item.updatedAt || doc.created_at, ...item }
}

export async function GET() {
  const ctx = await context(); if ('error' in ctx) return ctx.error
  const { data, error } = await ctx.admin.from('docs').select('id,content,created_at,updated_at').eq('workspace_id', ctx.workspaceId).eq('template_type', 'content_direction').order('updated_at', { ascending: false }).limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ directions: (data || []).map((doc) => parseDoc(doc as JsonRecord)) })
}

export async function POST(request: Request) {
  const ctx = await context(); if ('error' in ctx) return ctx.error
  const item = normalize(await request.json().catch(() => ({})) as JsonRecord)
  if (!item.title || !item.account || !item.whySave || !item.reusableTemplate) return NextResponse.json({ error: '請填寫標題、帳號、收藏原因及可重用方向' }, { status: 400 })
  const { data, error } = await ctx.admin.from('docs').insert({ workspace_id: ctx.workspaceId, template_type: 'content_direction', title: item.title, content: JSON.stringify({ ...item, createdAt: new Date().toISOString() }) }).select('id,content,created_at,updated_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ direction: parseDoc(data as JsonRecord) })
}

export async function PATCH(request: Request) {
  const ctx = await context(); if ('error' in ctx) return ctx.error
  const body = await request.json().catch(() => ({})) as JsonRecord
  const id = text(body.id, 80)
  if (!id) return NextResponse.json({ error: '缺少研究 ID' }, { status: 400 })
  const item = normalize(body)
  const { data, error } = await ctx.admin.from('docs').update({ title: item.title, content: JSON.stringify(item), updated_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', ctx.workspaceId).eq('template_type', 'content_direction').select('id,content,created_at,updated_at').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: '找不到研究' }, { status: 404 })
  return NextResponse.json({ direction: parseDoc(data as JsonRecord) })
}
