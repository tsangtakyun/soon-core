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

  const body = (await request.json()) as { workspaceId?: string; email?: string; role?: string }
  const email = body.email?.trim().toLowerCase()
  const role = body.role === 'admin' ? 'admin' : 'member'

  if (!body.workspaceId || !email) {
    return NextResponse.json({ error: 'Missing workspace or email' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { data: currentMember } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', body.workspaceId)
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!currentMember || !['owner', 'admin'].includes(currentMember.role)) {
    return NextResponse.json({ error: 'Only owners or admins can invite members' }, { status: 403 })
  }

  const token = crypto.randomUUID()
  const { data: invitation, error } = await admin
    .from('invitations')
    .insert({
      workspace_id: body.workspaceId,
      email,
      role,
      token,
      invited_by: session.user.id,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const inviteLink = `${new URL(request.url).origin}/invite?token=${token}`
  let emailWarning = ''

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteLink,
  })
  if (inviteError) {
    emailWarning = inviteError.message
  }

  return NextResponse.json({ invitation, inviteLink, emailWarning })
}
