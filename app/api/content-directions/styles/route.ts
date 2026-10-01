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
    const styleIds = payload.styles.map((style) => style.styleId)
    const [{ data: drafts, error: draftError }, { data: publishedReferences, error: referenceError }] = await Promise.all([
      admin.from('template_master_drafts')
        .select('id,style_id,target_version,status,page_designs,updated_at')
        .in('status', ['draft','review']).order('updated_at', { ascending: false }),
      styleIds.length
        ? admin.from('style_references')
            .select('id,style_id,style_version_id,source_url,source_account,evidence_summary,extracted_patterns')
            .in('style_id', styleIds)
            .eq('confirmation_status', 'confirmed')
            .in('source_scope', ['public_research', 'soon_owned'])
        : Promise.resolve({ data: [], error: null }),
    ])
    if (draftError || referenceError) throw draftError || referenceError
    return NextResponse.json({ ...payload, masterDrafts: drafts ?? [], publishedReferences: publishedReferences ?? [] })
  } catch (error) {
    console.error('Content direction styles unavailable', error)
    return NextResponse.json({ error: '未能載入已發布內容風格' }, { status: 500 })
  }
}
