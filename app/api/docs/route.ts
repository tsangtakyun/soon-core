import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

type DocPayload = {
  id?: string
  ids?: string[]
  workspace_id?: string | null
  [key: string]: unknown
}

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

export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
  }

  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)

  if (workspaceIds.length === 0) {
    return NextResponse.json({ docs: [], workspaces: [], folders: [], settings: null })
  }

  const [docsResult, workspacesResult, foldersResult, settingsResult] = await Promise.all([
    admin.from('docs').select('*').in('workspace_id', workspaceIds).order('created_at', { ascending: false }),
    admin.from('workspaces').select('*').in('id', workspaceIds).order('created_at', { ascending: false }),
    admin.from('doc_folders').select('*').in('workspace_id', workspaceIds).order('created_at', { ascending: false }),
    admin.from('settings').select('document_header_base64').eq('user_id', 'tommy').maybeSingle(),
  ])

  if (docsResult.error) return NextResponse.json({ error: docsResult.error.message }, { status: 500 })
  if (workspacesResult.error) return NextResponse.json({ error: workspacesResult.error.message }, { status: 500 })
  if (foldersResult.error) return NextResponse.json({ error: foldersResult.error.message }, { status: 500 })

  return NextResponse.json({
    docs: docsResult.data ?? [],
    workspaces: workspacesResult.data ?? [],
    folders: foldersResult.data ?? [],
    settings: settingsResult.data ?? null,
  })
}

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
  }

  const body = (await request.json()) as DocPayload
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: '請填寫文件標題。' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)
  const workspaceId = resolveWorkspaceId(body.workspace_id, workspaceIds)
  if (!workspaceId) {
    return NextResponse.json({ error: '找不到可用工作區，請先新增工作區。' }, { status: 400 })
  }

  const { id: _id, ids: _ids, workspace_id: _workspaceId, ...insertBody } = body
  const { data, error } = await admin
    .from('docs')
    .insert({
      ...insertBody,
      title,
      workspace_id: workspaceId,
      created_by: userId,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ doc: data })
}

export async function PATCH(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
  }

  const body = (await request.json()) as DocPayload
  const docId = typeof body.id === 'string' ? body.id : ''
  if (!docId) {
    return NextResponse.json({ error: '缺少文件 ID。' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)
  const { id: _id, ids: _ids, workspace_id: _workspaceId, ...updateBody } = body

  const { data, error } = await admin
    .from('docs')
    .update(updateBody)
    .eq('id', docId)
    .in('workspace_id', workspaceIds)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ doc: data })
}

export async function DELETE(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
  }

  const body = (await request.json()) as DocPayload
  const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'string' && id.length > 0) : []
  if (ids.length === 0) {
    return NextResponse.json({ error: '請先選取要刪除的文件。' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)
  const { error } = await admin.from('docs').delete().in('id', ids).in('workspace_id', workspaceIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
