import { NextRequest, NextResponse } from 'next/server'

import { requireCoreAdmin } from '@/lib/admin-auth'
import { applyVideoReferenceRestorations, loadAiReconstructionPromptSets, loadVideoReferenceRestorations } from '@/lib/internal-video-reference-restorations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin) return NextResponse.json({ error: '沒有管理權限' }, { status: 403 })
  const requestedFormat = request.nextUrl.searchParams.get('format')
  const format = requestedFormat === 'human' || requestedFormat === 'ai' ? requestedFormat : undefined
  try {
    const [restorations, promptSets] = await Promise.all([
      loadVideoReferenceRestorations(format),
      format === 'human' ? Promise.resolve([]) : loadAiReconstructionPromptSets(),
    ])
    return NextResponse.json({ restorations, promptSets })
  } catch (error) {
    console.error('Video reference restorations unavailable', error)
    return NextResponse.json({ error: '未能載入原片還原稿' }, { status: 500 })
  }
}

export async function POST() {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin) return NextResponse.json({ error: '沒有管理權限' }, { status: 403 })
  try {
    return NextResponse.json(await applyVideoReferenceRestorations(auth.userId))
  } catch (error) {
    console.error('Video reference restoration import failed', error)
    return NextResponse.json({ error: '未能匯入原片還原稿', detail: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
