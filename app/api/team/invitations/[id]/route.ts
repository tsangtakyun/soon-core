import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

async function requireTeamAdmin(invitationId: string) {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = createSupabaseAdmin()
  const { data: invitation, error } = await admin.from('invitations').select('*').eq('id', invitationId).maybeSingle()
  if (error || !invitation) return { error: NextResponse.json({ error: error?.message || 'Invitation not found' }, { status: 404 }) }

  const { data: member } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', invitation.workspace_id)
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!member || !['owner', 'admin'].includes(member.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { admin, invitation }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await requireTeamAdmin(id)
  if (result.error) return result.error

  const { error } = await result.admin.from('invitations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await requireTeamAdmin(id)
  if (result.error) return result.error

  const { data, error } = await result.admin
    .from('invitations')
    .update({ status: 'pending', expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const inviteLink = `${new URL(request.url).origin}/invite?token=${result.invitation.token}`
  let emailWarning = ''
  const { error: inviteError } = await result.admin.auth.admin.inviteUserByEmail(result.invitation.email, {
    redirectTo: inviteLink,
  })
  if (inviteError) emailWarning = inviteError.message

  return NextResponse.json({ invitation: data, inviteLink, emailWarning })
}
