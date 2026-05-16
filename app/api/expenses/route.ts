import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

type ExpensePayload = {
  id?: string
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
    return NextResponse.json({ expenses: [] })
  }

  const { data, error } = await admin
    .from('expenses')
    .select('*')
    .in('workspace_id', workspaceIds)
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ expenses: data ?? [] })
}

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
  }

  const body = (await request.json()) as ExpensePayload
  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)
  const workspaceId = resolveWorkspaceId(body.workspace_id, workspaceIds)

  if (!workspaceId) {
    return NextResponse.json({ error: '找不到可用工作區，請先新增工作區。' }, { status: 400 })
  }

  const { id: _id, workspace_id: _workspaceId, ...insertBody } = body
  const { data, error } = await admin
    .from('expenses')
    .insert({
      ...insertBody,
      workspace_id: workspaceId,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ expense: data })
}

export async function PATCH(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
  }

  const body = (await request.json()) as ExpensePayload
  const expenseId = typeof body.id === 'string' ? body.id : ''
  if (!expenseId) {
    return NextResponse.json({ error: '缺少支出 ID。' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)
  const { id: _id, workspace_id: _workspaceId, ...updateBody } = body
  const { data, error } = await admin
    .from('expenses')
    .update(updateBody)
    .eq('id', expenseId)
    .in('workspace_id', workspaceIds)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ expense: data })
}

export async function DELETE(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
  }

  const body = (await request.json()) as { id?: string }
  const expenseId = typeof body.id === 'string' ? body.id : ''
  if (!expenseId) {
    return NextResponse.json({ error: '缺少支出 ID。' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)
  const { error } = await admin.from('expenses').delete().eq('id', expenseId).in('workspace_id', workspaceIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
