import { NextResponse } from 'next/server'

import { requireCoreAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { loadPublishedStyles } from '@/lib/style-registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin) return NextResponse.json({ error: '沒有管理權限' }, { status: 403 })

  try {
    const payload = await loadPublishedStyles({ format: 'instagram_carousel' })
    const admin = createSupabaseAdmin()
    const { data: drafts, error } = await admin.from('template_master_drafts')
      .select('id,style_id,target_version,status,page_designs,updated_at')
      .in('status', ['draft','review']).order('updated_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ ...payload, masterDrafts: drafts ?? [] })
  } catch (error) {
    console.error('Content direction styles unavailable', error)
    return NextResponse.json({ error: '未能載入已發布內容風格' }, { status: 500 })
  }
}
