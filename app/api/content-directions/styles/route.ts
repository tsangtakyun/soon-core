import { NextResponse } from 'next/server'

import { requireCoreAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { isStyleFormat, loadPublishedStyles } from '@/lib/style-registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin) return NextResponse.json({ error: '沒有管理權限' }, { status: 403 })

  try {
    const requestedFormat = new URL(request.url).searchParams.get('format') ?? 'instagram_carousel'
    if (!isStyleFormat(requestedFormat)) {
      return NextResponse.json({ error: '不支援的內容格式' }, { status: 422 })
    }
    const payload = await loadPublishedStyles({ format: requestedFormat })
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
