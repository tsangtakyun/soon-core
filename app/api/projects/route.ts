import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

type ProjectPayload = {
  id?: string
  title?: string
  workspace_id?: string | null
  languages?: number
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
    return NextResponse.json({ projects: [], workspaces: [] })
  }

  const [projectsResult, workspacesResult] = await Promise.all([
    admin.from('projects').select('*').in('workspace_id', workspaceIds).order('created_at', { ascending: false }),
    admin.from('workspaces').select('*').in('id', workspaceIds).order('created_at', { ascending: false }),
  ])

  if (projectsResult.error) {
    return NextResponse.json({ error: projectsResult.error.message }, { status: 500 })
  }

  if (workspacesResult.error) {
    return NextResponse.json({ error: workspacesResult.error.message }, { status: 500 })
  }

  return NextResponse.json({
    projects: projectsResult.data ?? [],
    workspaces: workspacesResult.data ?? [],
  })
}

export async function POST(request: Request) {
  const userId = await getUserId()

  if (!userId) {
    return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
  }

  const body = (await request.json()) as ProjectPayload
  const title = typeof body.title === 'string' ? body.title.trim() : ''

  if (!title) {
    return NextResponse.json({ error: '請填寫題目。' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)
  const workspaceId = resolveWorkspaceId(body.workspace_id, workspaceIds)

  if (!workspaceId) {
    return NextResponse.json({ error: '找不到可用工作區，請先新增工作區。' }, { status: 400 })
  }

  const { id: _id, workspace_id: _workspaceId, ...insertBody } = body
  const { data, error } = await admin
    .from('projects')
    .insert({
      ...insertBody,
      title,
      workspace_id: workspaceId,
      created_by: userId,
      languages: typeof body.languages === 'number' ? body.languages : 3,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ project: data })
}

export async function DELETE(request: Request) {
  const userId = await getUserId()

  if (!userId) {
    return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
  }

  const body = (await request.json()) as { ids?: string[] }
  const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'string' && id.length > 0) : []

  if (ids.length === 0) {
    return NextResponse.json({ error: '請先選取要刪除的項目。' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)

  if (workspaceIds.length === 0) {
    return NextResponse.json({ error: '找不到可用工作區。' }, { status: 400 })
  }

  const { error } = await admin.from('projects').delete().in('id', ids).in('workspace_id', workspaceIds)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request) {
  const userId = await getUserId()

  if (!userId) {
    return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
  }

  const body = (await request.json()) as ProjectPayload
  const projectId = typeof body.id === 'string' ? body.id : ''

  if (!projectId) {
    return NextResponse.json({ error: '缺少項目 ID。' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: '請填寫題目。' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)
  const workspaceId = resolveWorkspaceId(body.workspace_id, workspaceIds)

  if (!workspaceId) {
    return NextResponse.json({ error: '找不到可用工作區，請先新增工作區。' }, { status: 400 })
  }

  const { id: _id, workspace_id: _workspaceId, languages: _languages, ...updateBody } = body
  const { data, error } = await admin
    .from('projects')
    .update({
      ...updateBody,
      title,
      workspace_id: workspaceId,
    })
    .eq('id', projectId)
    .in('workspace_id', workspaceIds)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ project: data })
}
