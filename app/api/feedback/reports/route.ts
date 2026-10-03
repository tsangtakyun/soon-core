import { randomUUID } from 'node:crypto'

import { after, NextResponse } from 'next/server'

import { requireFeedbackActor } from '@/lib/feedback-auth'
import {
  AUDIO_MIME_TYPES,
  buildFeedbackDedupeHash,
  buildFeedbackReference,
  cleanOptionalText,
  GENERAL_FILE_MIME_TYPES,
  isFeedbackProduct,
  MAX_AUDIO_BYTES,
  MAX_ATTACHMENT_REQUEST_BYTES,
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

function clientSourceContext(request: Request) {
  const referrer = request.headers.get('referer')
  let intakeHost: string | null = null
  try { intakeHost = referrer ? new URL(referrer).host : null } catch { intakeHost = null }
  return {
    submitted_from: 'core_feedback_portal',
    intake_host: intakeHost,
    user_agent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
  }
}

export async function GET(request: Request) {
  const actor = await requireFeedbackActor()
  if (!actor) return NextResponse.json({ error: '未獲授權使用回報系統' }, { status: 403 })

  const admin = createSupabaseAdmin()
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const product = url.searchParams.get('product')
  let query = admin
    .from('product_feedback_reports')
    .select('id,reference_number,reporter_email,reporter_name,product,description,status,assigned_to_email,ai_status,ai_title,ai_summary,ai_priority,ai_needs_discussion,is_test,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (!actor.isAdmin && !actor.sharedBoard) query = query.eq('reporter_user_id', actor.userId)
  if (status) query = query.eq('status', status)
  if (product) query = query.eq('product', product)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ actor, reports: data ?? [] })
}

export async function POST(request: Request) {
  const actor = await requireFeedbackActor()
  if (!actor) return NextResponse.json({ error: '未獲授權使用回報系統' }, { status: 403 })

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_ATTACHMENT_REQUEST_BYTES) return NextResponse.json({ error: '請求總大小超出 4MB 限制' }, { status: 413 })

  const isJson = request.headers.get('content-type')?.includes('application/json')
  const json = isJson ? await request.json().catch(() => ({})) as Record<string, unknown> : null
  const form = isJson ? null : await request.formData()
  const field = (name: string) => form?.get(name) ?? json?.[name]
  const product = field('product')
  const description = String(field('description') ?? '').trim()
  if (!isFeedbackProduct(product)) return NextResponse.json({ error: '請選擇產品' }, { status: 400 })
  if (description.length < 3 || description.length > 8000) return NextResponse.json({ error: '內容需要 3 至 8000 字' }, { status: 400 })

  const expectedBehavior = cleanOptionalText(field('expectedBehavior'), 4000)
  const problemUrl = cleanOptionalText(field('problemUrl'), 2048)
  const appVersion = cleanOptionalText(field('appVersion'), 120)
  const screenshots = form?.getAll('screenshots').filter((item): item is File => item instanceof File && item.size > 0) ?? []
  const generalFiles = form?.getAll('files').filter((item): item is File => item instanceof File && item.size > 0) ?? []
  const audio = form?.get('audio')
  const audioFile = audio instanceof File && audio.size > 0 ? audio : null

  if (screenshots.length > MAX_SCREENSHOTS) return NextResponse.json({ error: `最多上載 ${MAX_SCREENSHOTS} 張截圖` }, { status: 400 })
  if (generalFiles.length > MAX_GENERAL_FILES) return NextResponse.json({ error: `最多上載 ${MAX_GENERAL_FILES} 個檔案` }, { status: 400 })
  for (const file of screenshots) {
    if (!SCREENSHOT_MIME_TYPES.has(file.type) || file.size > MAX_SCREENSHOT_BYTES) {
      return NextResponse.json({ error: '圖片只接受 JPG、PNG、WEBP，每張最多 3MB' }, { status: 400 })
    }
  }
  for (const file of generalFiles) {
    if (!GENERAL_FILE_MIME_TYPES.has(file.type) || file.size > MAX_GENERAL_FILE_BYTES) {
      return NextResponse.json({ error: '檔案只接受 PDF、文字、Word、Excel，每個最多 3MB' }, { status: 400 })
    }
  }
  if (audioFile && (!AUDIO_MIME_TYPES.has(audioFile.type) || audioFile.size > MAX_AUDIO_BYTES)) {
    return NextResponse.json({ error: '語音只接受 MP3、M4A、WAV、WEBM、OGG，最多 3MB' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const dedupeHash = buildFeedbackDedupeHash({ reporterUserId: actor.userId, product, description, problemUrl })
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: duplicate } = await admin
    .from('product_feedback_reports')
    .select('id,reference_number')
    .eq('reporter_user_id', actor.userId)
    .eq('dedupe_hash', dedupeHash)
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (duplicate) return NextResponse.json({ ok: true, duplicate: true, reportId: duplicate.id, referenceNumber: duplicate.reference_number })

  const referenceNumber = buildFeedbackReference()
  const { data: report, error: reportError } = await admin.from('product_feedback_reports').insert({
    reference_number: referenceNumber,
    reporter_user_id: actor.userId,
    reporter_email: actor.email,
    reporter_name: actor.displayName,
    product,
    description,
    expected_behavior: expectedBehavior,
    problem_url: problemUrl,
    app_version: appVersion,
    source_context: clientSourceContext(request),
    dedupe_hash: dedupeHash,
    is_test: actor.isAdmin && field('isTest') === 'true',
  }).select('id,reference_number').single()
  if (reportError || !report) return NextResponse.json({ error: reportError?.message ?? '未能保存回報' }, { status: 500 })

  await admin.from('product_feedback_status_history').insert({
    report_id: report.id,
    from_status: null,
    to_status: 'pending_review',
    changed_by_user_id: actor.userId,
    changed_by_email: actor.email,
    note: '回報已提交',
  })

  const uploadWarnings: string[] = []
  const files = [
    ...screenshots.map((file) => ({ file, kind: 'screenshot' as const })),
    ...(audioFile ? [{ file: audioFile, kind: 'audio' as const }] : []),
    ...generalFiles.map((file) => ({ file, kind: 'file' as const })),
  ]
  for (const { file, kind } of files) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const path = `feedback/${actor.userId}/${report.id}/${randomUUID()}-${safeFeedbackFilename(file.name)}`
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: file.type, upsert: false })
    if (uploadError) {
      uploadWarnings.push(`${file.name}: ${uploadError.message}`)
      continue
    }
    const { error: attachmentError } = await admin.from('product_feedback_attachments').insert({
      report_id: report.id,
      uploaded_by: actor.userId,
      kind,
      storage_path: path,
      original_filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      sha256: sha256Buffer(buffer),
    })
    if (attachmentError) {
      await admin.storage.from(BUCKET).remove([path])
      uploadWarnings.push(`${file.name}: ${attachmentError.message}`)
    }
  }

  const deferAnalysis = json?.deferAnalysis === true
  if (!deferAnalysis) after(() => triageFeedbackReport(report.id))
  return NextResponse.json({
    ok: true,
    reportId: report.id,
    referenceNumber: report.reference_number,
    aiStatus: deferAnalysis ? 'queued_for_attachments' : 'queued',
    uploadWarnings,
  }, { status: 201 })
}
