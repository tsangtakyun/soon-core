'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { FEEDBACK_PRODUCT_LABELS, FEEDBACK_STATUS_LABELS, type FeedbackProduct, type FeedbackStatus } from '@/lib/feedback-shared'

type Styles = Record<string, string>
type Actor = { userId: string; email: string; displayName: string; isAdmin: boolean; feedbackOnly: boolean; sharedBoard: boolean }
type ReportSummary = {
  id: string; reference_number: string; reporter_email: string; product: FeedbackProduct; description: string
  status: FeedbackStatus; assigned_to_email: string | null; ai_status: string; ai_title: string | null
  ai_summary: string | null; is_test: boolean; created_at: string; updated_at: string
}
type Attachment = { id: string; message_id: string | null; kind: 'screenshot' | 'audio' | 'file'; original_filename: string; mime_type: string; size_bytes: number; downloadUrl: string }
type ReportDetail = {
  actor: Actor
  report: ReportSummary & {
    expected_behavior: string | null; problem_url: string | null; app_version: string | null; source_context: Record<string, unknown>
    ai_response: string | null; ai_reproduction_steps: string[]; ai_impact: string | null; ai_confirmed_evidence: string[]; ai_missing_information: string[]
    ai_possible_duplicates: string[]; ai_inference_notes: string[]; ai_error: string | null; audio_transcript: string | null
    ai_worth_optimizing: boolean | null; ai_optimization_reason: string | null; ai_suggested_adjustment: string | null; ai_priority: string | null; ai_needs_discussion: boolean | null
  }
  attachments: Attachment[]
  messages: Array<{ id: string; author_email: string; author_role: 'reporter' | 'admin'; body: string; created_at: string }>
  history: Array<{ id: string; from_status: FeedbackStatus | null; to_status: FeedbackStatus; changed_by_email: string | null; note: string | null; created_at: string }>
}
type AccessRow = { id: string; email: string; role: string; access_scope: string; status: string }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-HK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }).format(new Date(value))
}

function aiLabel(status: string) {
  return ({ queued: '排隊整理', processing: 'AI 整理中', completed: 'AI 已整理', failed: 'AI 整理失敗', not_configured: 'AI 尚未設定' } as Record<string, string>)[status] ?? status
}

export function FeedbackHub({ styles: s }: { styles: Styles }) {
  const searchParams = useSearchParams()
  const requestedProduct = searchParams.get('product')
  const prefillProduct = requestedProduct && requestedProduct in FEEDBACK_PRODUCT_LABELS ? requestedProduct : ''
  const prefillProblemUrl = searchParams.get('problem_url') ?? ''
  const prefillAppVersion = searchParams.get('app_version') ?? ''
  const [actor, setActor] = useState<Actor | null>(null)
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ referenceNumber: string; duplicate?: boolean; warnings?: string[] } | null>(null)
  const [message, setMessage] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [access, setAccess] = useState<AccessRow[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordedAudio, setRecordedAudio] = useState<File | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const loadReports = useCallback(async () => {
    const response = await fetch('/api/feedback/reports', { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || '未能載入回報')
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

  const loadAccess = useCallback(async () => {
    const response = await fetch('/api/feedback/access', { cache: 'no-store' })
    if (!response.ok) return
    const payload = await response.json()
    setAccess(payload.access ?? [])
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReports()
        .then((nextActor) => { if (nextActor.isAdmin) void loadAccess() })
        .catch((nextError) => setError(nextError instanceof Error ? nextError.message : '未能載入'))
        .finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadAccess, loadReports])

  useEffect(() => {
    if (!detail || !['queued', 'processing'].includes(detail.report.ai_status)) return
    const timer = window.setInterval(() => {
      void Promise.all([loadDetail(detail.report.id), loadReports()]).catch(() => null)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [detail, loadDetail, loadReports])

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true); setError(''); setSuccess(null)
    const form = event.currentTarget
    const formData = new FormData(form)
    if (recordedAudio) formData.set('audio', recordedAudio)
    try {
      const response = await fetch('/api/feedback/reports', { method: 'POST', body: formData })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || '未能提交回報')
      setSuccess({ referenceNumber: payload.referenceNumber, duplicate: payload.duplicate, warnings: payload.uploadWarnings })
      form.reset(); setRecordedAudio(null)
      await loadReports()
      if (payload.reportId) await loadDetail(payload.reportId)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '未能提交回報')
    } finally { setSubmitting(false) }
  }

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) audioChunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm'
        setRecordedAudio(new File(audioChunksRef.current, `voice-${Date.now()}.webm`, { type: type.split(';')[0] }))
        stream.getTracks().forEach((track) => track.stop())
      }
      recorder.start(); recorderRef.current = recorder; setRecording(true)
    } catch { setError('未能使用咪高峰，請改為上載語音檔。') }
  }

  function stopRecording() {
    recorderRef.current?.stop(); recorderRef.current = null; setRecording(false)
  }

  async function addMessage() {
    if (!detail || !message.trim()) return
    const response = await fetch(`/api/feedback/reports/${detail.report.id}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: message }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return setError(payload.error || '未能加入補充')
    setMessage(''); await loadDetail(detail.report.id)
  }

  async function updateReport(updates: Record<string, unknown>) {
    if (!detail) return
    const response = await fetch(`/api/feedback/reports/${detail.report.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...updates, note: statusNote }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return setError(payload.error || '未能更新')
    setStatusNote(''); await Promise.all([loadDetail(detail.report.id), loadReports()])
  }

  async function inviteReporter(event: React.FormEvent) {
    event.preventDefault()
    const response = await fetch('/api/feedback/access', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail, accessScope: 'feedback_shared' }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return setError(payload.error || '未能加入使用者')
    setInviteEmail(''); await loadAccess()
  }

  async function toggleAccess(row: AccessRow) {
    await fetch('/api/feedback/access', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, status: row.status === 'active' ? 'revoked' : 'active' }),
    })
    await loadAccess()
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <div>
          <div className={s.eyebrow}>SOON PRODUCT SUPPORT</div>
          <h1>問題與建議</h1>
          <p>請描述遇到嘅情況。系統會先保存回報，再交由 AI 協助整理；AI 狀態唔會影響提交。</p>
        </div>
        <div className={s.headerActions}>
          {actor?.isAdmin && <span className={s.adminBadge}>管理員模式</span>}
          {actor?.isAdmin && <Link href="/">返回 SOON Core</Link>}
        </div>
      </header>

      {loading && <div className={s.notice}>正在載入…</div>}
      {error && <div className={`${s.notice} ${s.error}`} role="alert">{error}</div>}
      {success && <div className={`${s.notice} ${s.success}`} role="status">
        <strong>{success.duplicate ? '相同回報已經存在' : '回報已保存'}</strong>
        <span>參考編號：{success.referenceNumber}</span>
        {success.warnings?.length ? <small>部分附件未能上載：{success.warnings.join('；')}</small> : null}
      </div>}

      {!loading && actor && <div className={s.layout}>
        <section className={s.panel}>
          <div className={s.panelHeading}><div><span>NEW REPORT</span><h2>提交新回報</h2></div></div>
          <form className={s.form} onSubmit={submitReport}>
            <label>產品<select name="product" required defaultValue={prefillProduct}><option value="" disabled>請選擇</option>{Object.entries(FEEDBACK_PRODUCT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>問題／建議描述<textarea name="description" required minLength={10} maxLength={8000} rows={6} placeholder="發生咗乜、你做過咩步驟、畫面有咩反應？" /></label>
            <label>預期應該點樣（選填）<textarea name="expectedBehavior" maxLength={4000} rows={3} placeholder="例如：按儲存後應該返回內容列表。" /></label>
            <div className={s.formGrid}>
              <label>問題頁面（選填）<input name="problemUrl" type="url" maxLength={2048} placeholder="https://…" defaultValue={prefillProblemUrl} /></label>
              <label>App／版本（選填）<input name="appVersion" maxLength={120} placeholder="例如 iOS 2.4.1" defaultValue={prefillAppVersion} /></label>
            </div>
            <div className={s.formGrid}>
              <label>截圖（最多 3 張）<input name="screenshots" type="file" accept="image/png,image/jpeg,image/webp" multiple /></label>
              <label>語音檔（最多 20MB）<input name="audio" type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/webm,audio/ogg" disabled={Boolean(recordedAudio)} /></label>
            </div>
            <div className={s.recorder}>
              <button type="button" onClick={recording ? stopRecording : startRecording}>{recording ? '停止錄音' : '錄低語音'}</button>
              <span>{recording ? '錄音中…' : recordedAudio ? `已錄製：${recordedAudio.name}` : '語音只用作呢次回報。'}</span>
              {recordedAudio && <button type="button" className={s.textButton} onClick={() => setRecordedAudio(null)}>移除</button>}
            </div>
            <p className={s.privacy}>截圖同語音會私密保存，只供獲授權嘅回報者及 SOON 管理員查看。回報不會自動授權系統改程式或部署。</p>
            <button className={s.primaryButton} disabled={submitting}>{submitting ? '正在保存…' : '提交並取得參考編號'}</button>
          </form>
        </section>

        <section className={s.panel}>
          <div className={s.panelHeading}><div><span>{actor.isAdmin ? 'ADMIN QUEUE' : 'MY REPORTS'}</span><h2>{actor.isAdmin ? '全部回報' : '我嘅回報'}</h2></div><b>{reports.length}</b></div>
          <div className={s.reportList}>
            {!reports.length && <div className={s.empty}>目前未有回報。</div>}
            {reports.map((report) => <button key={report.id} className={`${s.reportCard} ${detail?.report.id === report.id ? s.selected : ''}`} onClick={() => void loadDetail(report.id)}>
              <div><span className={s.reference}>{report.reference_number}</span>{report.is_test && <em>TEST</em>}</div>
              <strong>{report.ai_title || report.description}</strong>
              <small>{FEEDBACK_PRODUCT_LABELS[report.product]} · {formatDate(report.created_at)}</small>
              <div className={s.cardMeta}><span data-status={report.status}>{FEEDBACK_STATUS_LABELS[report.status]}</span><span>{aiLabel(report.ai_status)}</span></div>
            </button>)}
          </div>
        </section>
      </div>}

      {detail && <section className={`${s.panel} ${s.detailPanel}`}>
        <div className={s.panelHeading}><div><span>REPORT DETAIL</span><h2>{detail.report.ai_title || detail.report.reference_number}</h2></div><button className={s.closeButton} onClick={() => setDetail(null)}>關閉</button></div>
        <div className={s.detailGrid}>
          <article>
            <div className={s.detailMeta}><span>{detail.report.reference_number}</span><span>{FEEDBACK_PRODUCT_LABELS[detail.report.product]}</span><span>{FEEDBACK_STATUS_LABELS[detail.report.status]}</span><span>{formatDate(detail.report.created_at)}</span></div>
            <h3>原始回報</h3><p className={s.prewrap}>{detail.report.description}</p>
            {detail.report.expected_behavior && <><h3>預期行為</h3><p className={s.prewrap}>{detail.report.expected_behavior}</p></>}
            {(detail.report.problem_url || detail.report.app_version) && <div className={s.sourceBox}>{detail.report.problem_url && <a href={detail.report.problem_url} target="_blank" rel="noreferrer">開啟問題頁面</a>}{detail.report.app_version && <span>版本：{detail.report.app_version}</span>}</div>}
            {!!detail.attachments.length && <><h3>附件</h3><div className={s.attachments}>{detail.attachments.map((file) => <a key={file.id} href={file.downloadUrl} target="_blank" rel="noreferrer">{file.kind === 'audio' ? '語音' : file.kind === 'file' ? '檔案' : '截圖'} · {file.original_filename} <small>{Math.ceil(file.size_bytes / 1024)}KB</small></a>)}</div></>}
            {detail.report.audio_transcript && <><h3>語音轉錄</h3><p className={s.prewrap}>{detail.report.audio_transcript}</p></>}
          </article>
          <aside className={s.aiPanel}>
            <div className={s.aiHeading}><h3>AI 整理</h3><span data-ai={detail.report.ai_status}>{aiLabel(detail.report.ai_status)}</span></div>
            {detail.report.ai_response && <p>{detail.report.ai_response}</p>}
            {detail.report.ai_summary && <p>{detail.report.ai_summary}</p>}
            {!!detail.report.ai_confirmed_evidence?.length && <><h4>輸入中可確認證據</h4><ul>{detail.report.ai_confirmed_evidence.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
            {!!detail.report.ai_reproduction_steps?.length && <><h4>重現步驟</h4><ol>{detail.report.ai_reproduction_steps.map((step, index) => <li key={index}>{step}</li>)}</ol></>}
            {detail.report.ai_impact && <><h4>影響</h4><p>{detail.report.ai_impact}</p></>}
            {!!detail.report.ai_missing_information?.length && <><h4>尚欠資料</h4><ul>{detail.report.ai_missing_information.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
            {!!detail.report.ai_inference_notes?.length && <><h4>推斷（未驗證）</h4><ul>{detail.report.ai_inference_notes.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
            {!!detail.report.ai_possible_duplicates?.length && <><h4>可能重複（待人手確認）</h4><ul>{detail.report.ai_possible_duplicates.map((item) => <li key={item}>{item}</li>)}</ul></>}
            {detail.report.ai_optimization_reason && <><h4>值得優化？</h4><p>{detail.report.ai_worth_optimizing ? '值得' : '暫未證明需要'} — {detail.report.ai_optimization_reason}</p></>}
            {detail.report.ai_suggested_adjustment && <><h4>建議調整</h4><p>{detail.report.ai_suggested_adjustment}</p></>}
            {detail.report.ai_error && <p className={s.aiError}>{detail.report.ai_error}</p>}
            {!detail.report.ai_summary && !detail.report.ai_error && <p className={s.muted}>系統已保存原始回報，AI 整理稍後更新。</p>}
          </aside>
        </div>

        {actor?.isAdmin && <div className={s.adminControls}>
          <label>狀態<select value={detail.report.status} onChange={(event) => void updateReport({ status: event.target.value })}>{Object.entries(FEEDBACK_STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>負責人<input defaultValue={detail.report.assigned_to_email ?? ''} placeholder="電郵或名稱" onBlur={(event) => void updateReport({ assignedToEmail: event.target.value })} /></label>
          <label>進度備註<input value={statusNote} onChange={(event) => setStatusNote(event.target.value)} placeholder="隨下一次狀態更新記錄" /></label>
        </div>}

        <div className={s.conversation}><h3>跟進及補充</h3>{detail.messages.map((item) => <div key={item.id} className={item.author_role === 'admin' ? s.adminMessage : s.reporterMessage}><strong>{item.author_role === 'admin' ? 'SOON 團隊' : item.author_email}</strong><p>{item.body}</p><small>{formatDate(item.created_at)}</small></div>)}<div className={s.messageComposer}><textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} rows={3} placeholder="補充資料或回覆…" /><button onClick={() => void addMessage()} disabled={!message.trim()}>加入補充</button></div></div>
        <details className={s.history}><summary>狀態記錄（{detail.history.length}）</summary>{detail.history.map((item) => <div key={item.id}><span>{item.from_status ? FEEDBACK_STATUS_LABELS[item.from_status] : '建立回報'} → {FEEDBACK_STATUS_LABELS[item.to_status]}</span><small>{formatDate(item.created_at)} · {item.changed_by_email || '系統'}</small>{item.note && <p>{item.note}</p>}</div>)}</details>
      </section>}

      {actor?.isAdmin && <section className={`${s.panel} ${s.accessPanel}`}><div className={s.panelHeading}><div><span>ACCESS</span><h2>受邀回報者</h2></div></div><form onSubmit={inviteReporter} className={s.inviteForm}><input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="reporter@example.com" /><button>加入 feedback-only 帳戶</button></form><div className={s.accessList}>{access.map((row) => <div key={row.id}><span><strong>{row.email}</strong><small>{row.access_scope} · {row.role}</small></span><button onClick={() => void toggleAccess(row)}>{row.status === 'active' ? '停用' : '重新啟用'}</button></div>)}</div></section>}
    </main>
  )
}
