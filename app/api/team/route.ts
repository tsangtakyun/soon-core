import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

const defaultOwnerId = 'bb3e47cc-90c8-4eac-a5ff-cabfcefb89ae'
const defaultWorkspaceId = 'e8a76d7f-898f-4993-866c-5cda066eb24f'
const defaultOwnerEmail = 'tsangtakyun@gmail.com'
const defaultOwnerName = 'Tom T'

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

  const { data: existingOwner } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', defaultWorkspaceId)
    .eq('user_id', defaultOwnerId)
    .maybeSingle()

  if (!existingOwner) {
    await admin.from('workspace_members').insert({
      workspace_id: defaultWorkspaceId,
      user_id: defaultOwnerId,
      email: defaultOwnerEmail,
      display_name: defaultOwnerName,
      role: 'owner',
      status: 'active',
    })
  }

  const { data: memberships, error: membershipError } = await admin
    .from('workspace_members')
    .select('*, workspaces(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 })
  }

  const workspaceId = memberships?.[0]?.workspace_id ?? (userId === defaultOwnerId ? defaultWorkspaceId : null)
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
