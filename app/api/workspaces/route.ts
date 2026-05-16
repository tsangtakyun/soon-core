import { NextResponse } from 'next/server'

import { createSupabaseRouteClient } from '@/lib/supabase-route'

export async function POST(request: Request) {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
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

  const user = session.user
  const email = user.email ?? ''
  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    email.split('@')[0] ||
    'User'

  const { data: workspace, error: workspaceError } = await supabase
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
    return NextResponse.json({ error: workspaceError.message }, { status: 500 })
  }

  const { error: memberError } = await supabase.from('workspace_members').upsert(
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
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ workspace })
}
