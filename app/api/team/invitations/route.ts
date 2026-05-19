import { NextResponse } from 'next/server'
import { Resend } from 'resend'

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

  const inviteLink = `https://soon-core.vercel.app/invite?token=${token}`
  let emailWarning = ''

  try {
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      throw new Error('Missing RESEND_API_KEY')
    }

    const resend = new Resend(resendApiKey)
    const { error: emailError } = await resend.emails.send({
      from: 'SOON Core <onboarding@resend.dev>',
      to: [email],
      subject: '你收到 SOON Core 工作區邀請',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff;border-radius:12px">
          <h2 style="color:#7c3aed;margin-bottom:8px">⚡ SOON Core</h2>
          <p style="color:#ccc">你好！</p>
          <p style="color:#fff"><strong>Tom T</strong> 邀請你以 <strong style="color:#a78bfa">${role}</strong> 身份加入 SOON Core 工作區。</p>
          <a href="${inviteLink}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#7c3aed;color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
            ✅ 接受邀請
          </a>
          <p style="color:#666;font-size:12px;margin-top:16px">連結 7 日內有效。如非你申請，請忽略此郵件。</p>
          <p style="color:#444;font-size:11px">soon-core.vercel.app</p>
        </div>
      `,
    })

    if (emailError) {
      emailWarning = emailError.message
    }
  } catch (error) {
    emailWarning = error instanceof Error ? error.message : 'Failed to send invitation email'
  }

  return NextResponse.json({ invitation, inviteLink, emailWarning })
}
