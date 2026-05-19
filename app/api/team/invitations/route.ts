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
  const role = body.role === 'admin' || body.role === 'viewer' ? body.role : 'member'

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
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: invitation, error } = await admin
    .from('invitations')
    .insert({
      workspace_id: body.workspaceId,
      email,
      role,
      token,
      invited_by: session.user.id,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: existingMember } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', body.workspaceId)
    .eq('email', email)
    .maybeSingle()

  if (existingMember) {
    const { error: memberUpdateError } = await admin
      .from('workspace_members')
      .update({
        role,
        status: 'pending',
        invited_by: session.user.id,
      })
      .eq('id', existingMember.id)
    if (memberUpdateError) return NextResponse.json({ error: memberUpdateError.message }, { status: 500 })
  } else {
    const { error: memberInsertError } = await admin.from('workspace_members').insert({
      workspace_id: body.workspaceId,
      user_id: null,
      email,
      display_name: null,
      role,
      status: 'pending',
      invited_by: session.user.id,
    })
    if (memberInsertError) return NextResponse.json({ error: memberInsertError.message }, { status: 500 })
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
