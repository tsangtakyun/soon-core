'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'

import styles from '@/components/HomeFeedbackBoard.module.css'
import { FEEDBACK_PRODUCT_LABELS, FEEDBACK_STATUS_LABELS, type FeedbackProduct, type FeedbackStatus } from '@/lib/feedback-shared'
import { supabase } from '@/lib/supabase'

type Actor = {
  userId: string
  email: string
  displayName: string
  isAdmin: boolean
  feedbackOnly: boolean
  sharedBoard: boolean
}
type ReportSummary = {
  id: string
  reference_number: string
  reporter_email: string
  reporter_name: string | null
  product: FeedbackProduct
  description: string
  status: FeedbackStatus
  ai_status: string
  ai_title: string | null
  ai_summary: string | null
  ai_priority: string | null
  ai_needs_discussion: boolean | null
  created_at: string
}
type Attachment = {
  id: string
  message_id: string | null
  kind: 'screenshot' | 'audio' | 'file'
  original_filename: string
  size_bytes: number
  downloadUrl: string
}
type Message = {
  id: string
  author_email: string
  author_role: 'reporter' | 'admin'
  body: string
  ai_analysis_status: string
  created_at: string
}
type EngineeringTask = {
  disposition: 'eligible_auto_fix' | 'needs_discussion' | 'manual_engineering' | 'not_needed'
  execution_status: string
  runner_status: 'not_connected' | 'connected' | 'disabled' | null
  eligibility_reason: string | null
  commit_sha: string | null
  diff_summary: string | null
  test_evidence: unknown[]
  deployment_evidence: unknown[]
}
type ReportDetail = {
  actor: Actor
  report: ReportSummary & {
    expected_behavior: string | null
    problem_url: string | null
    app_version: string | null
    ai_response: string | null
    ai_reproduction_steps: string[]
    ai_impact: string | null
    ai_confirmed_evidence: string[]
    ai_missing_information: string[]
    ai_inference_notes: string[]
    ai_worth_optimizing: boolean | null
    ai_optimization_reason: string | null
    ai_suggested_adjustment: string | null
    ai_intent: string | null
    ai_error: string | null
    audio_transcript: string | null
  }
  attachments: Attachment[]
  messages: Message[]
  engineeringTask: EngineeringTask | null
}
type PendingUpload = {
  reportId: string
  messageId?: string
  screenshots: File[]
  files: File[]
  audio: File | null
}

const AI_LABELS: Record<string, string> = {
  queued: 'AI 排隊中',
  processing: 'AI 分析中',
  completed: 'AI 已分析',
  failed: 'AI 分析失敗',
  not_configured: 'AI 未接駁',
}
const DISPOSITION_LABELS: Record<string, string> = {
  eligible_auto_fix: '可自動修正候選',
  needs_discussion: '需要討論',
  manual_engineering: '待工程處理',
  not_needed: '暫不需工程',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-HK', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(value))
}

function attachmentLabel(item: Attachment) {
  if (item.kind === 'audio') return '語音'
  if (item.kind === 'screenshot') return '圖片'
  return '檔案'
}

export function HomeFeedbackBoard() {
  const [actor, setActor] = useState<Actor | null>(null)
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [replying, setReplying] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reply, setReply] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordedAudio, setRecordedAudio] = useState<File | null>(null)
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const composerFormRef = useRef<HTMLFormElement | null>(null)
  const replyFormRef = useRef<HTMLFormElement | null>(null)

  const loadReports = useCallback(async () => {
    const response = await fetch('/api/feedback/reports', { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || '未能載入共同回報板')
    setActor(payload.actor)
    setReports(payload.reports ?? [])
    return payload.actor as Actor
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    const response = await fetch(`/api/feedback/reports/${id}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || '未能載入回報詳情')
    setDetail(payload)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReports()
        .catch((reason) => setError(reason instanceof Error ? reason.message : '未能載入共同回報板'))
        .finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadReports])

  useEffect(() => {
    if (!detail || !['queued', 'processing'].includes(detail.report.ai_status)) return
    const timer = window.setInterval(() => {
      void Promise.all([loadDetail(detail.report.id), loadReports()]).catch(() => null)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [detail, loadDetail, loadReports])

  async function uploadAttachments(input: PendingUpload) {
    const attachmentForm = new FormData()
    input.screenshots.forEach((file) => attachmentForm.append('screenshots', file))
    input.files.forEach((file) => attachmentForm.append('files', file))
    if (input.audio) attachmentForm.set('audio', input.audio)
    if (input.messageId) attachmentForm.set('messageId', input.messageId)
    const response = await fetch(`/api/feedback/reports/${input.reportId}/attachments`, {
      method: 'POST',
      body: attachmentForm,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok && response.status !== 207) throw new Error(payload.error || '未能上載附件')
    if (payload.uploadWarnings?.length) throw new Error(`部分附件未能上載：${payload.uploadWarnings.join('；')}`)
  }

  async function retryPendingUpload() {
    if (!pendingUpload) return
    setSubmitting(true)
    setError('')
    try {
      await uploadAttachments(pendingUpload)
      if (pendingUpload.messageId) replyFormRef.current?.reset()
      else {
        composerFormRef.current?.reset()
        setRecordedAudio(null)
      }
      setPendingUpload(null)
      setNotice('附件已成功上載，AI 分析已重新排隊。')
      await Promise.allSettled([loadReports(), loadDetail(pendingUpload.reportId)])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '未能上載附件；原檔仍保留在此頁，可再次重試。')
    } finally {
      setSubmitting(false)
    }
  }

  function discardPendingUpload() {
    if (pendingUpload?.messageId) replyFormRef.current?.reset()
    else {
      composerFormRef.current?.reset()
      setRecordedAudio(null)
    }
    setPendingUpload(null)
    setNotice('文字已保存；未成功的附件已從待重試清單移除。')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const screenshots = formData.getAll('screenshots').filter((item): item is File => item instanceof File && item.size > 0)
    const files = formData.getAll('files').filter((item): item is File => item instanceof File && item.size > 0)
    const selectedAudio = formData.get('audio')
    const audio = recordedAudio ?? (selectedAudio instanceof File && selectedAudio.size > 0 ? selectedAudio : null)
    const hasAttachments = screenshots.length > 0 || files.length > 0 || Boolean(audio)
    setSubmitting(true)
    setError('')
    setNotice('')
    let attachmentFailed = false
    try {
      const response = await fetch('/api/feedback/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product: formData.get('product'),
          description: formData.get('description'),
          expectedBehavior: formData.get('expectedBehavior'),
          problemUrl: formData.get('problemUrl'),
          appVersion: formData.get('appVersion'),
          isTest: formData.get('isTest'),
          deferAnalysis: hasAttachments,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || '未能保存內容')
      setNotice(`${payload.duplicate ? '相同內容已存在' : '內容已保存'} · ${payload.referenceNumber}`)
      if (hasAttachments && payload.reportId) {
        const upload = { reportId: payload.reportId, screenshots, files, audio }
        try {
          await uploadAttachments(upload)
          setNotice(`內容及附件已保存 · ${payload.referenceNumber}`)
        } catch (uploadError) {
          attachmentFailed = true
          setPendingUpload(upload)
          setError(uploadError instanceof Error ? `${uploadError.message}；文字及參考編號已保存，可直接重試附件。` : '附件未能上載；文字及參考編號已保存，可直接重試附件。')
        }
      }
      if (!attachmentFailed) {
        form.reset()
        setRecordedAudio(null)
      }
      const refreshes = await Promise.allSettled([
        loadReports(),
        payload.reportId ? loadDetail(payload.reportId) : Promise.resolve(),
      ])
      if (refreshes.some((item) => item.status === 'rejected')) {
        setNotice(`內容已保存 · ${payload.referenceNumber}；列表暫時未能更新，重新整理頁面後仍可查看。`)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '未能保存內容')
    } finally {
      setSubmitting(false)
    }
  }

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const mimeType = (recorder.mimeType || 'audio/webm').split(';')[0]
        setRecordedAudio(new File(chunksRef.current, `voice-${Date.now()}.webm`, { type: mimeType }))
        stream.getTracks().forEach((track) => track.stop())
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
    } catch {
      setError('未能使用麥克風；你仍可上載錄音檔。')
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }

  async function addReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!detail || !reply.trim()) return
    setReplying(true)
    setError('')
    const form = event.currentTarget
    const formData = new FormData(form)
    const screenshots = formData.getAll('screenshots').filter((item): item is File => item instanceof File && item.size > 0)
    const files = formData.getAll('files').filter((item): item is File => item instanceof File && item.size > 0)
    const audioItem = formData.get('audio')
    const audio = audioItem instanceof File && audioItem.size > 0 ? audioItem : null
    let attachmentFailed = false
    try {
      const response = await fetch(`/api/feedback/reports/${detail.report.id}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: reply.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || '未能加入補充')
      const hasAttachments = screenshots.length > 0 || files.length > 0 || Boolean(audio)
      if (hasAttachments && payload.message?.id) {
        const upload = { reportId: detail.report.id, messageId: payload.message.id, screenshots, files, audio }
        try {
          await uploadAttachments(upload)
        } catch (uploadError) {
          attachmentFailed = true
          setPendingUpload(upload)
          setError(uploadError instanceof Error ? `${uploadError.message}；補充文字已保存，可直接重試附件。` : '附件未能上載；補充文字已保存，可直接重試附件。')
        }
      }
      setReply('')
      if (!attachmentFailed) form.reset()
      const refreshes = await Promise.allSettled([loadDetail(detail.report.id), loadReports()])
      if (refreshes.some((item) => item.status === 'rejected')) {
        setNotice('補充內容已保存；列表暫時未能更新，重新整理頁面後仍可查看。')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '未能加入補充')
    } finally {
      setReplying(false)
    }
  }

  async function retryAnalysis() {
    if (!detail) return
    const response = await fetch(`/api/feedback/reports/${detail.report.id}/retry`, { method: 'POST' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setError(payload.error || '未能重試'); return }
    setNotice('AI 已重新排隊；原始內容一直保留。')
    await loadDetail(detail.report.id)
  }

  const initialAttachments = detail?.attachments.filter((item) => !item.message_id) ?? []

  return (
    <section className={styles.board} aria-label="共同問題與建議板">
      <div className={styles.intro}>
        <div><span>SOON SHARED BOARD</span><h2>有甚麼問題或建議？</h2></div>
        <p>系統會先保存文字，再交由 AI 分析。附件或 AI 處理失敗，均不會令原文遺失。</p>
      </div>

      <form ref={composerFormRef} className={styles.composer} onSubmit={submit}>
        <div className={styles.composerTop}>
          <select name="product" required defaultValue="soon_core" aria-label="選擇產品">
            {Object.entries(FEEDBACK_PRODUCT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <span>{actor?.sharedBoard || actor?.isAdmin ? 'Tommy × Renee 共同測試板' : '個人回報'}</span>
        </div>
        <textarea name="description" required minLength={3} maxLength={8000} rows={3} placeholder="輸入問題、建議、一般提問，或描述你所見的情況…" />
        <details className={styles.advanced}>
          <summary>補充預期結果、網址或版本</summary>
          <div>
            <textarea name="expectedBehavior" maxLength={4000} rows={2} placeholder="你預期系統應如何運作？（選填）" />
            <input name="problemUrl" type="url" maxLength={2048} placeholder="問題頁面 URL（選填）" />
            <input name="appVersion" maxLength={120} placeholder="App／版本（選填）" />
          </div>
        </details>
        <div className={styles.actions}>
          <label>＋ 圖片<input name="screenshots" type="file" accept="image/png,image/jpeg,image/webp" multiple /></label>
          <label>＋ 檔案<input name="files" type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx,.xls,.xlsx" multiple /></label>
          <label>＋ 錄音檔<input name="audio" type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/webm,audio/ogg" disabled={Boolean(recordedAudio)} /></label>
          <button type="button" className={recording ? styles.recording : ''} onClick={recording ? stopRecording : startRecording}>{recording ? '■ 停止錄音' : '● 直接錄音'}</button>
          {recordedAudio && <button type="button" onClick={() => setRecordedAudio(null)}>移除已錄音</button>}
          <button className={styles.send} disabled={submitting}>{submitting ? '保存中…' : '送出 →'}</button>
        </div>
        <small className={styles.uploadHint}>每次附件請求上限為 4MB；單一圖片、檔案或錄音最多 3MB。文字會先獨立保存。</small>
      </form>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {notice && <div className={styles.notice} role="status">{notice}</div>}
      {pendingUpload && <div className={styles.notice} role="status">文字已保存；原附件仍保留在此頁。<button type="button" disabled={submitting} onClick={() => void retryPendingUpload()}>{submitting ? '重試中…' : '重試附件上載'}</button><button type="button" disabled={submitting} onClick={discardPendingUpload}>放棄附件</button></div>}

      <div className={styles.feedHeader}><div><span>COMMENTS</span><h3>共同回報與對話</h3></div><b>{reports.length}</b></div>
      {loading ? <div className={styles.empty}>載入中…</div> : !reports.length ? <div className={styles.empty}>暫時沒有內容。你可以直接在上方提交第一則回報。</div> : (
        <div className={styles.feed}>
          {reports.map((report) => (
            <button key={report.id} className={`${styles.card} ${detail?.report.id === report.id ? styles.selected : ''}`} onClick={() => void loadDetail(report.id)}>
              <div className={styles.cardMeta}><strong>{report.reporter_name || report.reporter_email}</strong><span>{FEEDBACK_PRODUCT_LABELS[report.product]}</span><time>{formatDate(report.created_at)}</time></div>
              <h4>{report.ai_title || report.description}</h4>
              <p>{report.ai_summary || report.description}</p>
              <footer><span>{FEEDBACK_STATUS_LABELS[report.status]}</span><span>{AI_LABELS[report.ai_status] || report.ai_status}</span>{report.ai_priority && <span>{report.ai_priority.toUpperCase()}</span>}{report.ai_needs_discussion && <em>需要討論</em>}</footer>
            </button>
          ))}
        </div>
      )}

      {detail && <article className={styles.detail}>
        <header><div><span>{detail.report.reference_number}</span><h3>{detail.report.ai_title || detail.report.description}</h3></div><button onClick={() => setDetail(null)}>關閉</button></header>
        <div className={styles.original}><strong>{detail.report.reporter_name || detail.report.reporter_email}</strong><small>{FEEDBACK_PRODUCT_LABELS[detail.report.product]} · {formatDate(detail.report.created_at)}</small><p>{detail.report.description}</p></div>
        {!!initialAttachments.length && <AttachmentList items={initialAttachments} />}

        <section className={styles.analysis}>
          <div className={styles.analysisHeading}><h4>AI 分析</h4><span>{AI_LABELS[detail.report.ai_status] || detail.report.ai_status}</span></div>
          {detail.report.ai_response && <div className={styles.aiResponse}>{detail.report.ai_response}</div>}
          {detail.report.ai_summary && <AnalysisBlock title="問題摘要"><p>{detail.report.ai_summary}</p></AnalysisBlock>}
          {!!detail.report.ai_confirmed_evidence?.length && <AnalysisBlock title="輸入中可確認證據"><List items={detail.report.ai_confirmed_evidence} /></AnalysisBlock>}
          {!!detail.report.ai_inference_notes?.length && <AnalysisBlock title="推測／待確認"><List items={detail.report.ai_inference_notes} /></AnalysisBlock>}
          {detail.report.ai_worth_optimizing !== null && <AnalysisBlock title="值得優化？"><p>{detail.report.ai_worth_optimizing ? '值得' : '暫未證明需要'} — {detail.report.ai_optimization_reason || '未有原因'}</p></AnalysisBlock>}
          {detail.report.ai_suggested_adjustment && <AnalysisBlock title="建議調整"><p>{detail.report.ai_suggested_adjustment}</p></AnalysisBlock>}
          <div className={styles.analysisBadges}><span>影響：{FEEDBACK_PRODUCT_LABELS[detail.report.product]}</span><span>優先：{detail.report.ai_priority || '待分析'}</span><span>{detail.report.ai_needs_discussion ? '需要討論' : '未標示需討論'}</span></div>
          {detail.report.ai_error && <div className={styles.error}>AI：{detail.report.ai_error}<button onClick={() => void retryAnalysis()}>重試分析</button></div>}
        </section>

        <section className={styles.engineering}>
          <h4>工程閉環</h4>
          {detail.engineeringTask ? <><div><span>{DISPOSITION_LABELS[detail.engineeringTask.disposition] || detail.engineeringTask.disposition}</span><b>{detail.engineeringTask.execution_status === 'not_connected' || detail.engineeringTask.execution_status === 'awaiting_engineering' ? '待工程處理' : detail.engineeringTask.execution_status}</b></div><p>{detail.engineeringTask.eligibility_reason}</p>{detail.engineeringTask.runner_status === 'not_connected' && <p>工程任務已加入可審計工作清單，但目前未連接自動工程執行器，必須由工程人員接手及提交驗證證據。</p>}{detail.engineeringTask.commit_sha && <code>{detail.engineeringTask.commit_sha}</code>}</> : <p>AI 完成分析後才會建立工程判斷。系統未有工程執行器時，只會標示為「待工程處理」，不會聲稱已完成修正。</p>}
        </section>

        <section className={styles.thread}>
          <h4>對話及跟進</h4>
          {detail.messages.map((item) => {
            const attachments = detail.attachments.filter((attachment) => attachment.message_id === item.id)
            return <div className={styles.message} key={item.id}><div><strong>{item.author_email}</strong><time>{formatDate(item.created_at)}</time><span>{AI_LABELS[item.ai_analysis_status] || item.ai_analysis_status}</span></div><p>{item.body}</p>{attachments.length > 0 && <AttachmentList items={attachments} />}</div>
          })}
          <form ref={replyFormRef} className={styles.reply} onSubmit={addReply}>
            <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} maxLength={4000} placeholder="補充資料或繼續對話…" />
            <div><label>圖片<input name="screenshots" type="file" accept="image/png,image/jpeg,image/webp" multiple /></label><label>檔案<input name="files" type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx,.xls,.xlsx" multiple /></label><label>錄音<input name="audio" type="file" accept="audio/*" /></label><button disabled={!reply.trim() || replying}>{replying ? '保存中…' : '回覆 →'}</button></div>
          </form>
        </section>
      </article>}
    </section>
  )
}

function AttachmentList({ items }: { items: Attachment[] }) {
  return <div className={styles.attachments}>{items.map((item) => <a key={item.id} href={item.downloadUrl} target="_blank" rel="noreferrer">{attachmentLabel(item)} · {item.original_filename} <small>{Math.ceil(item.size_bytes / 1024)}KB</small></a>)}</div>
}

function AnalysisBlock({ title, children }: { title: string; children: ReactNode }) {
  return <div className={styles.analysisBlock}><h5>{title}</h5>{children}</div>
}

function List({ items }: { items: string[] }) {
  return <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
}

export function FeedbackOnlyHome({ displayName }: { displayName: string }) {
  const router = useRouter()
  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }
  return <main className={styles.feedbackOnlyPage}><header><div><span>SOON CORE</span><h1>早晨，{displayName}。</h1><p>此頁只顯示 Tommy × Renee 共同測試板；公司營運及敏感資料不會向此帳戶開放。</p></div><button onClick={() => void signOut()}>登出</button></header><HomeFeedbackBoard /></main>
}

export function AdminHomeFeedbackMount() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>('.chief-hero')
    if (!hero) return
    const mount = document.createElement('div')
    mount.className = 'home-feedback-mount'
    hero.insertAdjacentElement('afterend', mount)
    const chiefChat = document.querySelector<HTMLElement>('.chief-chat')
    const previousDisplay = chiefChat?.style.display
    if (chiefChat) chiefChat.style.display = 'none'
    const timer = window.setTimeout(() => setTarget(mount), 0)
    return () => {
      window.clearTimeout(timer)
      if (chiefChat) chiefChat.style.display = previousDisplay ?? ''
      mount.remove()
    }
  }, [])
  return target ? createPortal(<HomeFeedbackBoard />, target) : null
}
