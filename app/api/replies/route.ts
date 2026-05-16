import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

type InboxType = 'email' | 'message' | 'fans'

type ReplyThreadPayload = {
  id?: string
  workspace_id?: string | null
  inbox_type?: InboxType
  sender_name?: string | null
  sender_handle?: string | null
  original_message?: string
  ai_reply?: string | null
  user_edited_reply?: string | null
  status?: string
  tags?: string[]
  notes?: string | null
  follow_up_date?: string | null
  updated_at?: string
}

const inboxTypes: InboxType[] = ['email', 'message', 'fans']

async function getUserId() {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.user?.id ?? null
}

async function getWorkspaceIds(admin: ReturnType<typeof createSupabaseAdmin>, userId: string) {
  const { data, error } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) throw error

  return (data ?? [])
    .map((row) => row.workspace_id)
    .filter((id): id is string => Boolean(id))
}

function resolveWorkspaceId(requestedWorkspaceId: string | null | undefined, workspaceIds: string[]) {
  if (requestedWorkspaceId && workspaceIds.includes(requestedWorkspaceId)) {
    return requestedWorkspaceId
  }

  return workspaceIds[0] ?? null
}

function defaultSettings(userId: string, inboxType: InboxType) {
  return {
    user_id: userId,
    inbox_type: inboxType,
    assistant_name: 'Mayan',
    tone: 'friendly',
    reply_length: 'standard',
    creator_context: '',
    avoid_topics: '',
  }
}

function schemaMissingResponse(error: { code?: string; message?: string }) {
  if (error.code === 'PGRST205' || error.message?.includes('reply_threads') || error.message?.includes('reply_settings')) {
    return NextResponse.json(
      { error: '回覆中心資料表未建立，請先在 Supabase 跑 reply centre migration。' },
      { status: 500 },
    )
  }

  return NextResponse.json({ error: error.message ?? '回覆中心操作失敗' }, { status: 500 })
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
  }

  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)
  const threadsQuery = admin.from('reply_threads').select('*').order('updated_at', { ascending: false })
  const settingsQuery = admin.from('reply_settings').select('*').eq('user_id', userId)

  if (workspaceIds.length > 0) {
    threadsQuery.in('workspace_id', workspaceIds)
  } else {
    threadsQuery.is('workspace_id', null)
  }

  const [{ data: threads, error: threadsError }, { data: settings, error: settingsError }] = await Promise.all([
    threadsQuery,
    settingsQuery,
  ])

  if (threadsError) return schemaMissingResponse(threadsError)
  if (settingsError) return schemaMissingResponse(settingsError)

  const missingSettings = inboxTypes
    .filter((inbox) => !(settings ?? []).some((setting) => setting.inbox_type === inbox))
    .map((inbox) => defaultSettings(userId, inbox))

  if (missingSettings.length > 0) {
    const { error } = await admin
      .from('reply_settings')
      .upsert(missingSettings, { onConflict: 'user_id,inbox_type' })
    if (error) return schemaMissingResponse(error)
  }

  return NextResponse.json({
    threads: threads ?? [],
    settings: [...(settings ?? []), ...missingSettings],
  })
}

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
  }

  const body = (await request.json()) as ReplyThreadPayload
  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)
  const workspaceId = resolveWorkspaceId(body.workspace_id, workspaceIds)

  if (!workspaceId) {
    return NextResponse.json({ error: '找不到可用工作區，請先新增工作區。' }, { status: 400 })
  }

  const { id: _id, workspace_id: _workspaceId, ...insertBody } = body
  const { data, error } = await admin
    .from('reply_threads')
    .insert({
      ...insertBody,
      workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) return schemaMissingResponse(error)

  return NextResponse.json({ thread: data })
}

export async function PATCH(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
  }

  const body = (await request.json()) as ReplyThreadPayload
  const threadId = typeof body.id === 'string' ? body.id : ''
  if (!threadId) {
    return NextResponse.json({ error: '缺少訊息 ID。' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)
  const { id: _id, workspace_id: _workspaceId, ...updateBody } = body
  const { data, error } = await admin
    .from('reply_threads')
    .update({ ...updateBody, updated_at: new Date().toISOString() })
    .eq('id', threadId)
    .in('workspace_id', workspaceIds)
    .select('*')
    .single()

  if (error) return schemaMissingResponse(error)

  return NextResponse.json({ thread: data })
}

export async function DELETE(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
  }

  const body = (await request.json()) as { id?: string }
  const threadId = typeof body.id === 'string' ? body.id : ''
  if (!threadId) {
    return NextResponse.json({ error: '缺少訊息 ID。' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)
  const { error } = await admin.from('reply_threads').delete().eq('id', threadId).in('workspace_id', workspaceIds)

  if (error) return schemaMissingResponse(error)

  return NextResponse.json({ ok: true })
}
