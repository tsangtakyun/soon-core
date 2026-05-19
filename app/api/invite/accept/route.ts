import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const { token } = (await request.json()) as { token?: string }
  if (!token) {
    return NextResponse.json({ ok: false, expired: false }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  const { data: invitation } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .single()

  if (!invitation) return NextResponse.json({ ok: false, expired: false })
  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, expired: true })
  }

  await supabase.from('invitations').update({ status: 'accepted' }).eq('id', invitation.id)

  await supabase
    .from('workspace_members')
    .update({ status: 'active' })
    .eq('email', invitation.email)
    .eq('workspace_id', invitation.workspace_id)

  return NextResponse.json({ ok: true })
}
