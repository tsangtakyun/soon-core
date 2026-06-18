import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

const RECEIPT_BUCKET = 'finance-receipts'

type UploadUrlPayload = {
  fileName?: string
  mimeType?: string
  workspace_id?: string | null
}

async function getUserId() {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.user?.id ?? null
}

async function getWorkspaceIds(admin: ReturnType<typeof createSupabaseAdmin>, userId: string) {
  const { data, error } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) throw error

  return (data ?? [])
    .map((row) => row.workspace_id)
    .filter((id): id is string => Boolean(id))
}

async function ensureBucket(admin: ReturnType<typeof createSupabaseAdmin>) {
  const { data } = await admin.storage.getBucket(RECEIPT_BUCKET)
  if (data) return

  const { error } = await admin.storage.createBucket(RECEIPT_BUCKET, {
    public: false,
    fileSizeLimit: 30 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'],
  })

  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw error
  }
}

function safeFileName(value: string) {
  const cleaned = value
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 90)

  return cleaned || 'receipt'
}

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: '請先登入。' }, { status: 401 })
  }

  const body = (await request.json()) as UploadUrlPayload
  const admin = createSupabaseAdmin()
  const workspaceIds = await getWorkspaceIds(admin, userId)
  const requestedWorkspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : null
  const workspaceId = requestedWorkspaceId && workspaceIds.includes(requestedWorkspaceId)
    ? requestedWorkspaceId
    : (workspaceIds[0] ?? 'personal')

  await ensureBucket(admin)

  const now = new Date()
  const month = now.toISOString().slice(0, 7)
  const random = crypto.randomUUID()
  const fileName = safeFileName(body.fileName ?? 'receipt')
  const path = `${userId}/${workspaceId}/${month}/${random}-${fileName}`

  const { data, error } = await admin.storage
    .from(RECEIPT_BUCKET)
    .createSignedUploadUrl(path)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    bucket: RECEIPT_BUCKET,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    fileName,
    mimeType: body.mimeType ?? null,
  })
}
