import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

const RECEIPT_BUCKET = 'finance-receipts'

type FileUrlPayload = {
  path?: string
}

async function getUserId() {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.user?.id ?? null
}

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: '請先登入。' }, { status: 401 })
  }

  const body = (await request.json()) as FileUrlPayload
  const path = typeof body.path === 'string' ? body.path : ''

  if (!path || !path.startsWith(`${userId}/`)) {
    return NextResponse.json({ error: '無權查看此單據。' }, { status: 403 })
  }

  const admin = createSupabaseAdmin()
  const { data, error } = await admin.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(path, 60 * 10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
