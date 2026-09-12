import { NextResponse } from 'next/server'

import { requireCoreAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function styleAdminContext() {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin || !auth.userId) return { error: NextResponse.json({ error: '沒有管理權限' }, { status: 403 }) }
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('workspace_members').select('workspace_id').eq('user_id', auth.userId).eq('status', 'active').limit(1).maybeSingle()
  if (!data?.workspace_id) return { error: NextResponse.json({ error: '找不到可用工作區' }, { status: 400 }) }
  return { admin, userId: auth.userId, workspaceId: data.workspace_id as string }
}

export const bodyText = (value: unknown, max = 2000) => typeof value === 'string' ? value.trim().slice(0, max) : ''
