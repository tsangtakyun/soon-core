import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

export async function POST(request: Request) {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workspaceName, displayName } = (await request.json()) as { workspaceName?: string; displayName?: string }
  const name = workspaceName?.trim()
  if (!name) return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const user = session.user
  const email = user.email ?? ''
  const resolvedDisplayName = displayName?.trim() || user.user_metadata?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0] || 'User'

  const { data: existingMembership } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (existingMembership) {
    return NextResponse.json({ workspaceId: existingMembership.workspace_id, existing: true })
  }

  const { data: workspace, error: workspaceError } = await admin
    .from('workspaces')
    .insert({ name, type: 'youtube', owner_id: user.id, owner: resolvedDisplayName })
    .select('id')
    .single()

  if (workspaceError) return NextResponse.json({ error: workspaceError.message }, { status: 500 })

  const { error: memberError } = await admin.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: user.id,
    email,
    display_name: resolvedDisplayName,
    role: 'owner',
    status: 'active',
    invited_by: user.id,
  })

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  return NextResponse.json({ workspaceId: workspace.id, existing: false })
}
