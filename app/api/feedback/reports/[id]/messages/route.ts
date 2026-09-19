import { randomUUID } from 'node:crypto'

import { after, NextResponse } from 'next/server'

import { canReadFeedbackReport, requireFeedbackActor } from '@/lib/feedback-auth'
import {
  AUDIO_MIME_TYPES,
  GENERAL_FILE_MIME_TYPES,
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
  const { id } = await context.params
  if (!(await canReadFeedbackReport(id, actor))) return NextResponse.json({ error: '找不到回報' }, { status: 404 })

  const multipart = request.headers.get('content-type')?.includes('multipart/form-data')
  const form = multipart ? await request.formData() : null
  const payload = form ? null : await request.json().catch(() => ({})) as { body?: unknown }
  const rawBody = form?.get('body') ?? payload?.body
  const body = typeof rawBody === 'string' ? rawBody.trim() : ''
  if (!body || body.length > 4000) return NextResponse.json({ error: '補充內容需要 1 至 4000 字' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data, error } = await admin.from('product_feedback_messages').insert({
    report_id: id,
    author_user_id: actor.userId,
    author_email: actor.email,
    author_role: actor.isAdmin ? 'admin' : 'reporter',
    body,
  }).select('id,author_email,author_role,body,created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const uploadWarnings: string[] = []
  if (form) {
    const screenshots = form.getAll('screenshots').filter((item): item is File => item instanceof File && item.size > 0).slice(0, MAX_SCREENSHOTS)
    const audioItem = form.get('audio')
    const audio = audioItem instanceof File && audioItem.size > 0 ? audioItem : null
    const files = form.getAll('files').filter((item): item is File => item instanceof File && item.size > 0).slice(0, MAX_GENERAL_FILES)
    const uploads = [
      ...screenshots.map((file) => ({ file, kind: 'screenshot' as const, valid: SCREENSHOT_MIME_TYPES.has(file.type) && file.size <= MAX_SCREENSHOT_BYTES })),
      ...(audio ? [{ file: audio, kind: 'audio' as const, valid: AUDIO_MIME_TYPES.has(audio.type) && audio.size <= MAX_AUDIO_BYTES }] : []),
      ...files.map((file) => ({ file, kind: 'file' as const, valid: GENERAL_FILE_MIME_TYPES.has(file.type) && file.size <= MAX_GENERAL_FILE_BYTES })),
    ]
    for (const { file, kind, valid } of uploads) {
      if (!valid) { uploadWarnings.push(`${file.name}: 檔案類型或大小不符合限制`); continue }
      const buffer = Buffer.from(await file.arrayBuffer())
      const path = `feedback/${actor.userId}/${id}/messages/${data.id}/${randomUUID()}-${safeFeedbackFilename(file.name)}`
      const uploaded = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: file.type, upsert: false })
      if (uploaded.error) { uploadWarnings.push(`${file.name}: ${uploaded.error.message}`); continue }
      const attachment = await admin.from('product_feedback_attachments').insert({
        report_id: id,
        message_id: data.id,
        uploaded_by: actor.userId,
        kind,
        storage_path: path,
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        sha256: sha256Buffer(buffer),
      })
      if (attachment.error) {
        await admin.storage.from(BUCKET).remove([path])
        uploadWarnings.push(`${file.name}: ${attachment.error.message}`)
      }
    }
  }

  await admin.from('product_feedback_reports').update({ ai_status: 'queued', ai_error: null }).eq('id', id)
  after(() => triageFeedbackReport(id, data.id))
  return NextResponse.json({ ok: true, message: data, uploadWarnings }, { status: 201 })
}
