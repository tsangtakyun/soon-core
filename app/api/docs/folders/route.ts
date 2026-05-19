import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

type FolderPayload = {
  id?: string
  name?: string
  workspace_id?: string | null
}

async function getUserId() {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.user?.id ?? null
}

async function isWorkspaceMember(userId: string, workspaceId: string) {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('workspace_members')
    .select('id')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

async function getFolderWorkspaceId(folderId: string) {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin.from('doc_folders').select('workspace_id').eq('id', folderId).maybeSingle()

  if (error) throw error
  return data?.workspace_id ?? null
}

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: '請先登入' }, { status: 401 })

  const body = (await request.json()) as FolderPayload
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : ''

  if (!name) return NextResponse.json({ error: '請輸入文件夾名稱' }, { status: 400 })
  if (!workspaceId) return NextResponse.json({ error: '請先選擇工作區' }, { status: 400 })

  const canAccessWorkspace = await isWorkspaceMember(userId, workspaceId)
  if (!canAccessWorkspace) return NextResponse.json({ error: '沒有此工作區權限' }, { status: 403 })

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('doc_folders')
    .insert({ name, workspace_id: workspaceId })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ folder: data })
}

export async function PATCH(request: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: '請先登入' }, { status: 401 })

  const body = (await request.json()) as FolderPayload
  const folderId = typeof body.id === 'string' ? body.id : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!folderId) return NextResponse.json({ error: '缺少文件夾 ID' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '請輸入文件夾名稱' }, { status: 400 })

  const workspaceId = await getFolderWorkspaceId(folderId)
  if (!workspaceId) return NextResponse.json({ error: '找不到文件夾' }, { status: 404 })

  const canAccessWorkspace = await isWorkspaceMember(userId, workspaceId)
  if (!canAccessWorkspace) return NextResponse.json({ error: '沒有此工作區權限' }, { status: 403 })

  const admin = createSupabaseAdmin()
  const { data, error } = await admin.from('doc_folders').update({ name }).eq('id', folderId).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ folder: data })
}

export async function DELETE(request: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: '請先登入' }, { status: 401 })

  const body = (await request.json()) as FolderPayload
  const folderId = typeof body.id === 'string' ? body.id : ''
  if (!folderId) return NextResponse.json({ error: '缺少文件夾 ID' }, { status: 400 })

  const workspaceId = await getFolderWorkspaceId(folderId)
  if (!workspaceId) return NextResponse.json({ error: '找不到文件夾' }, { status: 404 })

  const canAccessWorkspace = await isWorkspaceMember(userId, workspaceId)
  if (!canAccessWorkspace) return NextResponse.json({ error: '沒有此工作區權限' }, { status: 403 })

  const admin = createSupabaseAdmin()
  const clearDocsResult = await admin
    .from('docs')
    .update({ folder_id: null })
    .eq('folder_id', folderId)
    .eq('workspace_id', workspaceId)

  if (clearDocsResult.error) return NextResponse.json({ error: clearDocsResult.error.message }, { status: 500 })

  const { error } = await admin.from('doc_folders').delete().eq('id', folderId).eq('workspace_id', workspaceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
