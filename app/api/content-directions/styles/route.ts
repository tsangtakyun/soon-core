import { NextResponse } from 'next/server'

import { requireCoreAdmin } from '@/lib/admin-auth'
import { loadPublishedStyles } from '@/lib/style-registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin) return NextResponse.json({ error: '沒有管理權限' }, { status: 403 })

  try {
    const payload = await loadPublishedStyles({ format: 'instagram_carousel' })
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Content direction styles unavailable', error)
    return NextResponse.json({ error: '未能載入已發布內容風格' }, { status: 500 })
  }
}
