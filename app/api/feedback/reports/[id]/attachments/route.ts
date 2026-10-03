import { randomUUID } from 'node:crypto'

import { after, NextResponse } from 'next/server'

import { canReadFeedbackReport, requireFeedbackActor } from '@/lib/feedback-auth'
import {
  AUDIO_MIME_TYPES,
  GENERAL_FILE_MIME_TYPES,
  MAX_ATTACHMENT_REQUEST_BYTES,
  MAX_AUDIO_BYTES,
  MAX_GENERAL_FILE_BYTES,
  MAX_GENERAL_FILES,
  MAX_SCREENSHOT_BYTES,
  MAX_SCREENSHOTS,
  safeFeedbackFilename,
  SCREENSHOT_MIME_TYPES,
  sha256Buffer,
} from '@/lib/feedback-contract'
import { triageFeedbackReport } from '@/lib/feedback-triage'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const maxDuration = 60

const BUCKET = 'product-feedback-private'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireFeedbackActor()
  if (!actor) return NextResponse.json({ error: '未獲授權' }, { status: 403 })

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_ATTACHMENT_REQUEST_BYTES) {
    return NextResponse.json({ error: '附件請求超出 4MB 平台限制，請減少檔案數量或大小。' }, { status: 413 })
  }

  const { id } = await context.params
  if (!(await canReadFeedbackReport(id, actor))) {
    return NextResponse.json({ error: '找不到回報' }, { status: 404 })
  }
  const admin = createSupabaseAdmin()

  const form = await request.formData()
  const messageId = String(form.get('messageId') ?? '').trim() || null
  if (messageId) {
    const { data: message } = await admin
      .from('product_feedback_messages')
      .select('id,report_id,author_user_id')
      .eq('id', messageId)
      .eq('report_id', id)
      .maybeSingle()
    if (!message || (!actor.isAdmin && message.author_user_id !== actor.userId)) {
      return NextResponse.json({ error: '找不到補充內容' }, { status: 404 })
    }
  }

  const screenshots = form.getAll('screenshots').filter((item): item is File => item instanceof File && item.size > 0)
  const files = form.getAll('files').filter((item): item is File => item instanceof File && item.size > 0)
  const audioItem = form.get('audio')
  const audio = audioItem instanceof File && audioItem.size > 0 ? audioItem : null

  if (screenshots.length > MAX_SCREENSHOTS) return NextResponse.json({ error: `每次最多上載 ${MAX_SCREENSHOTS} 張圖片` }, { status: 400 })
  if (files.length > MAX_GENERAL_FILES) return NextResponse.json({ error: `每次最多上載 ${MAX_GENERAL_FILES} 個檔案` }, { status: 400 })

  const uploads = [
    ...screenshots.map((file) => ({ file, kind: 'screenshot' as const, valid: SCREENSHOT_MIME_TYPES.has(file.type) && file.size <= MAX_SCREENSHOT_BYTES })),
    ...(audio ? [{ file: audio, kind: 'audio' as const, valid: AUDIO_MIME_TYPES.has(audio.type) && audio.size <= MAX_AUDIO_BYTES }] : []),
    ...files.map((file) => ({ file, kind: 'file' as const, valid: GENERAL_FILE_MIME_TYPES.has(file.type) && file.size <= MAX_GENERAL_FILE_BYTES })),
  ]
  if (!uploads.length) return NextResponse.json({ error: '沒有可上載的附件' }, { status: 400 })
  if (uploads.some((item) => !item.valid)) {
    return NextResponse.json({ error: '附件格式不支援，或單一檔案超出 3MB。' }, { status: 400 })
  }

  const uploadWarnings: string[] = []
  const uploadedAttachments: Array<{ id: string; original_filename: string }> = []
  for (const { file, kind } of uploads) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const segment = messageId ? `messages/${messageId}` : 'initial'
    const path = `feedback/${actor.userId}/${id}/${segment}/${randomUUID()}-${safeFeedbackFilename(file.name)}`
    const uploaded = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: file.type, upsert: false })
    if (uploaded.error) {
      uploadWarnings.push(`${file.name}: ${uploaded.error.message}`)
      continue
    }
    const attachment = await admin.from('product_feedback_attachments').insert({
      report_id: id,
      message_id: messageId,
      uploaded_by: actor.userId,
      kind,
      storage_path: path,
      original_filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      sha256: sha256Buffer(buffer),
    }).select('id,original_filename').single()
    if (attachment.error || !attachment.data) {
      await admin.storage.from(BUCKET).remove([path])
      uploadWarnings.push(`${file.name}: ${attachment.error?.message ?? '未能登記附件'}`)
      continue
    }
    uploadedAttachments.push(attachment.data)
  }

  after(() => triageFeedbackReport(id, messageId ?? undefined))
  return NextResponse.json({
    ok: uploadWarnings.length === 0,
    uploadedAttachments,
    uploadWarnings,
  }, { status: uploadWarnings.length ? 207 : 201 })
}
