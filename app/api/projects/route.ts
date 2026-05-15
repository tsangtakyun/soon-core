import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

type ProjectPayload = {
  id?: string
  title?: string
  workspace_id?: string | null
  [key: string]: unknown
}

async function getSessionUser() {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.user ?? null
}

async function getUserWorkspaceIds(admin: ReturnType<typeof createSupabaseAdmin>, userId: string) {
  const { data, error } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) throw error
  return (data ?? []).map((item) => item.workspace_id).filter(Boolean) as string[]
}

function resolveWorkspaceId(requestedWorkspaceId: string | null | undefined, workspaceIds: string[]) {
  if (requestedWorkspaceId && workspaceIds.includes(requestedWorkspaceId)) return requestedWorkspaceId
  return workspaceIds[0] ?? null
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as ProjectPayload
  if (!String(body.title ?? '').trim()) {
    return NextResponse.json({ error: '請輸入題目' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const workspaceIds = await getUserWorkspaceIds(admin, user.id)
  const workspaceId = resolveWorkspaceId(body.workspace_id, workspaceIds)

  if (!workspaceId) {
    return NextResponse.json({ error: '請先建立工作區' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('projects')
    .insert({
      ...body,
      workspace_id: workspaceId,
      created_by: user.id,
      languages: body.languages ?? 3,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data })
}

export async function PATCH(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as ProjectPayload
  const projectId = body.id
  if (!projectId) return NextResponse.json({ error: 'Missing project id' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const workspaceIds = await getUserWorkspaceIds(admin, user.id)
  const workspaceId = resolveWorkspaceId(body.workspace_id, workspaceIds)

  if (!workspaceId) {
    return NextResponse.json({ error: '請先建立工作區' }, { status: 400 })
  }

  const { id: _id, ...payload } = body
  const { data, error } = await admin
    .from('projects')
    .update({
      ...payload,
      workspace_id: workspaceId,
      created_by: user.id,
    })
    .eq('id', projectId)
    .in('workspace_id', workspaceIds)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data })
}
