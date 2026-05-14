import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data: invitation, error } = await admin
    .from('invitations')
    .select('*, workspaces(name)')
    .eq('token', token)
    .maybeSingle()

  if (error || !invitation) return NextResponse.json({ error: error?.message || 'Invitation not found' }, { status: 404 })
  if (invitation.status !== 'pending' || new Date(invitation.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Invitation expired or already used' }, { status: 410 })
  }

  return NextResponse.json({ invitation })
}

export async function POST(request: Request) {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = (await request.json()) as { token?: string }
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data: invitation, error } = await admin.from('invitations').select('*').eq('token', token).maybeSingle()
  if (error || !invitation) return NextResponse.json({ error: error?.message || 'Invitation not found' }, { status: 404 })
  if (invitation.status !== 'pending' || new Date(invitation.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Invitation expired or already used' }, { status: 410 })
  }

  const email = session.user.email ?? invitation.email
  const displayName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split('@')[0]

  const { error: memberError } = await admin.from('workspace_members').upsert(
    {
      workspace_id: invitation.workspace_id,
      user_id: session.user.id,
      email,
      display_name: displayName,
      role: invitation.role,
      status: 'active',
      invited_by: invitation.invited_by,
    },
    { onConflict: 'workspace_id,user_id' }
  )
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  const { error: invitationError } = await admin.from('invitations').update({ status: 'accepted' }).eq('id', invitation.id)
  if (invitationError) return NextResponse.json({ error: invitationError.message }, { status: 500 })

  return NextResponse.json({ ok: true, workspaceId: invitation.workspace_id })
}
