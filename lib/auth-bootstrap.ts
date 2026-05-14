import type { User } from '@supabase/supabase-js'

import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function bootstrapUserWorkspace(user: User) {
  const admin = createSupabaseAdmin()
  const email = user.email ?? ''
  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0] || 'Tommy'

  const { data: existingMembership } = await admin
    .from('workspace_members')
    .select('id, workspace_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (existingMembership) {
    return { workspaceId: existingMembership.workspace_id as string }
  }

  const { data: workspace, error: workspaceError } = await admin
    .from('workspaces')
    .insert({ name: 'SOON Channel', type: 'youtube', owner_id: user.id, owner: displayName })
    .select('id')
    .single()

  if (workspaceError) throw new Error(workspaceError.message)

  const workspaceId = workspace.id as string

  const { error: memberError } = await admin.from('workspace_members').insert({
    workspace_id: workspaceId,
    user_id: user.id,
    email,
    display_name: displayName,
    role: 'owner',
    status: 'active',
    invited_by: user.id,
  })
  if (memberError) throw new Error(memberError.message)

  await Promise.all([
    admin.from('projects').update({ workspace_id: workspaceId, created_by: user.id }).is('workspace_id', null),
    admin.from('docs').update({ workspace_id: workspaceId, created_by: user.id }).is('workspace_id', null),
    admin.from('expenses').update({ workspace_id: workspaceId, created_by: user.id }).is('workspace_id', null),
    admin.from('reply_threads').update({ workspace_id: workspaceId, created_by: user.id }).is('workspace_id', null),
  ])

  return { workspaceId }
}
