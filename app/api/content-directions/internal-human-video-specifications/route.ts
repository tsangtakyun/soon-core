import { NextResponse } from 'next/server'

import { requireCoreAdmin } from '@/lib/admin-auth'
import { applyInternalHumanVideoSpecifications, loadInternalHumanVideoSpecifications } from '@/lib/internal-human-video-specifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin) return NextResponse.json({ error: '沒有管理權限' }, { status: 403 })
  try {
    return NextResponse.json({ specifications: await loadInternalHumanVideoSpecifications() })
  } catch (error) {
    console.error('Internal human-video specifications unavailable', error)
    return NextResponse.json({ error: '未能載入 Core 內部真人短片規格' }, { status: 500 })
  }
}

export async function POST() {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin) return NextResponse.json({ error: '沒有管理權限' }, { status: 403 })
  try {
    return NextResponse.json(await applyInternalHumanVideoSpecifications(auth.userId))
  } catch (error) {
    console.error('Internal human-video specification import failed', error)
    return NextResponse.json({ error: '未能匯入 Core 內部真人短片規格', detail: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

