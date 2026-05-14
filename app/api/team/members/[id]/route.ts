import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

async function requireOwner(memberId: string) {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = createSupabaseAdmin()
  const { data: target, error } = await admin.from('workspace_members').select('*').eq('id', memberId).maybeSingle()
  if (error || !target) return { error: NextResponse.json({ error: error?.message || 'Member not found' }, { status: 404 }) }

  const { data: current } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', target.workspace_id)
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (current?.role !== 'owner') {
    return { error: NextResponse.json({ error: 'Only owners can manage members' }, { status: 403 }) }
  }

  return { admin, target }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await requireOwner(id)
  if (result.error) return result.error

  const body = (await request.json()) as { role?: string }
  const role = body.role === 'admin' || body.role === 'owner' ? body.role : 'member'

  const { data, error } = await result.admin.from('workspace_members').update({ role }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await requireOwner(id)
  if (result.error) return result.error

  if (result.target.role === 'owner') {
    return NextResponse.json({ error: 'Owner cannot be removed' }, { status: 400 })
  }

  const { error } = await result.admin.from('workspace_members').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
