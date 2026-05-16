import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

async function getSessionUser() {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return { supabase, user: session?.user ?? null }
}

async function canManageWorkspace(admin: ReturnType<typeof createSupabaseAdmin>, workspaceId: string, userId: string, ownerOnly = false) {
  const { data: membership, error: memberError } = await admin
    .from('workspace_members')
    .select('role,status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (memberError) throw memberError

  if (membership?.role === 'owner') return true
  if (!ownerOnly && membership?.role === 'admin') return true

  const { data: workspace, error: workspaceError } = await admin
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .maybeSingle()

  if (workspaceError) throw workspaceError

  return workspace?.owner_id === userId
}

function isMissingRelationError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : ''
  return code === '42P01' || code === '42703'
}

async function deleteWorkspaceRelatedRows(admin: ReturnType<typeof createSupabaseAdmin>, workspaceId: string) {
  const tables = ['projects', 'docs', 'expenses', 'reply_threads', 'financial_reports', 'doc_folders', 'invitations', 'workspace_members']

  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq('workspace_id', workspaceId)
    if (error && !isMissingRelationError(error)) throw error
  }
}

export async function POST(request: Request) {
  const { supabase, user } = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string
    type?: string
    owner?: string
    description?: string
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 })
  }

  const email = user.email ?? ''
  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    email.split('@')[0] ||
    'User'

  let { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({
      name,
      type: body.type || 'youtube',
      owner_id: user.id,
      owner: body.owner?.trim() || displayName,
      description: body.description?.trim() || null,
    })
    .select('*')
    .single()

  if (workspaceError) {
    try {
      const admin = createSupabaseAdmin()
      const adminResult = await admin
        .from('workspaces')
        .insert({
          name,
          type: body.type || 'youtube',
          owner_id: user.id,
          owner: body.owner?.trim() || displayName,
          description: body.description?.trim() || null,
        })
        .select('*')
        .single()

      workspace = adminResult.data
      workspaceError = adminResult.error
    } catch {
      // Keep the original RLS error below so the caller sees the real DB issue.
    }
  }

  if (workspaceError || !workspace) {
    return NextResponse.json(
      {
        error:
          workspaceError?.message ||
          '新增工作區失敗。請確認 Supabase workspaces RLS policy 已允許登入用戶新增。',
      },
      { status: 500 }
    )
  }

  let { error: memberError } = await supabase.from('workspace_members').upsert(
    {
      workspace_id: workspace.id,
      user_id: user.id,
      email,
      display_name: displayName,
      role: 'owner',
      status: 'active',
      invited_by: user.id,
    },
    { onConflict: 'workspace_id,user_id' }
  )

  if (memberError) {
    try {
      const admin = createSupabaseAdmin()
      const adminMemberResult = await admin.from('workspace_members').upsert(
        {
          workspace_id: workspace.id,
          user_id: user.id,
          email,
          display_name: displayName,
          role: 'owner',
          status: 'active',
          invited_by: user.id,
        },
        { onConflict: 'workspace_id,user_id' }
      )
      memberError = adminMemberResult.error
    } catch {
      // Keep the original RLS error below.
    }
  }

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ workspace })
}

export async function PATCH(request: Request) {
  const { user } = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string
    name?: string
    type?: string
    owner?: string | null
    description?: string | null
  }

  if (!body.id) {
    return NextResponse.json({ error: 'Workspace id is required' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const allowed = await canManageWorkspace(admin, body.id, user.id)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('workspaces')
    .update({
      name,
      type: body.type || 'youtube',
      owner: body.owner?.trim() || null,
      description: body.description?.trim() || null,
    })
    .eq('id', body.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ workspace: data })
}

export async function DELETE(request: Request) {
  const { user } = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { id?: string }
  const workspaceId = body.id

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace id is required' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const allowed = await canManageWorkspace(admin, workspaceId, user.id, true)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await deleteWorkspaceRelatedRows(admin, workspaceId)
    const { error } = await admin.from('workspaces').delete().eq('id', workspaceId)
    if (error) throw error
  } catch (error) {
    const message = error instanceof Error ? error.message : '刪除工作區失敗。'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
