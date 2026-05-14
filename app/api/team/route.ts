import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

export async function GET() {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createSupabaseAdmin()
  const userId = session.user.id

  const { data: memberships, error: membershipError } = await admin
    .from('workspace_members')
    .select('*, workspaces(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 })
  }

  const workspaceId = memberships?.[0]?.workspace_id ?? null
  if (!workspaceId) {
    return NextResponse.json({ user: session.user, workspaces: [], members: [], invitations: [] })
  }

  const [{ data: members, error: membersError }, { data: invitations, error: invitationsError }] = await Promise.all([
    admin.from('workspace_members').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: true }),
    admin.from('invitations').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
  ])

  if (membersError || invitationsError) {
    return NextResponse.json({ error: membersError?.message || invitationsError?.message }, { status: 500 })
  }

  return NextResponse.json({
    user: session.user,
    activeWorkspaceId: workspaceId,
    workspaces: memberships?.map((item) => item.workspaces).filter(Boolean) ?? [],
    currentRole: memberships?.[0]?.role ?? 'member',
    members: members ?? [],
    invitations: invitations ?? [],
  })
}
