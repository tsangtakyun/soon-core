'use client'

import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { CoreDoc } from '@/lib/types'

type Lang = 'zh' | 'en'

type MeetingContent = {
  language: Lang
  title: string
  date: string
  meetingType: string
  facilitator: string
  attendees: string
  agenda: string[]
  discussions: Array<{ id: string; title: string; notes: string }>
  actionItems: Array<{ id: string; action: string; owner: string; dueDate: string }>
  nextSteps: string
  createdAt: string
  updatedAt: string
}

type AiIssue = {
  section: 'agenda' | 'discussion' | 'action_items' | 'next_steps' | string
  issue: string
  suggestion: string
}

type AiReview = {
  overall?: string
  score?: number
  issues?: AiIssue[]
  missing?: string
  clarity?: string
}

type Props = {
  doc: CoreDoc
  onBack: () => void
  onSaved: (doc: CoreDoc) => void
}

const langStorageKey = 'soon-meeting-notes-lang'

const copy = {
  zh: {
    back: '← 文件中心',
    chinese: '中文',
    english: 'English',
    save: 'Save',
    saved: '已儲存',
    pdf: '匯出 PDF',
    word: '匯出 Word',
    ai: '✨ AI 審閱',
    reviewing: '分析中...',
    clearReview: '清除審閱',
    title: '會議記錄',
    meta: (created: string, updated: string) => `建立者 Tommy · 已建立 ${created} · 最近更新 ${updated}`,
    overview: '📋 概覽',
    date: '日期',
    meetingType: '會議類型',
    meetingTypePlaceholder: '例如：Weekly sync / Planning / Review',
    facilitator: '主持人',
    facilitatorPlaceholder: 'Add name',
    attendees: '出席者',
    attendeesPlaceholder: 'Add names',
    agenda: '📋 議程',
    addAgenda: '+ 新增議程',
    discussion: '💬 討論記錄',
    addDiscussion: '+ 新增討論項目',
    discussionPlaceholder: '總結重點、決定同討論背景...',
    actionItems: '✅ 行動項目',
    action: '行動項目',
    owner: '負責人',
    dueDate: '截止日期',
    addRow: '+ 新增',
    actionPlaceholder: 'Describe the action item',
    ownerPlaceholder: '@name',
    nextSteps: '🚀 下一步',
    nextStepsPlaceholder: '下一步係咩？邊個負責？下次 touchpoint 係幾時？',
  },
  en: {
    back: '← Docs Center',
    chinese: '中文',
    english: 'English',
    save: 'Save',
    saved: 'Saved',
    pdf: 'Export PDF',
    word: 'Export Word',
    ai: '✨ AI Review',
    reviewing: 'Analysing...',
    clearReview: 'Clear Review',
    title: 'Meeting Notes',
    meta: (created: string, updated: string) => `Created by Tommy · Created ${created} · Last updated ${updated}`,
    overview: '📋 Overview',
    date: 'Date',
    meetingType: 'Meeting type',
    meetingTypePlaceholder: 'e.g. Weekly sync / Planning / Review',
    facilitator: 'Facilitator',
    facilitatorPlaceholder: 'Add name',
    attendees: 'Attendees',
    attendeesPlaceholder: 'Add names',
    agenda: '📋 Agenda',
    addAgenda: '+ Add Agenda Item',
    discussion: '💬 Discussion Notes',
    addDiscussion: '+ Add Discussion Topic',
    discussionPlaceholder: 'Summarize key points, decisions, and context discussed...',
    actionItems: '✅ Action Items',
    action: 'Action Item',
    owner: 'Owner',
    dueDate: 'Due Date',
    addRow: '+ Add Row',
    actionPlaceholder: 'Describe the action item',
    ownerPlaceholder: '@name',
    nextSteps: '🚀 Next Steps',
    nextStepsPlaceholder: 'What happens next? Who is responsible? When is the next touchpoint?',
  },
} as const

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

export function createEmptyMeetingNotes(language: Lang = 'zh'): MeetingContent {
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  return {
    language,
    title: language === 'zh' ? '會議記錄' : 'Meeting Notes',
    date: today,
    meetingType: '',
    facilitator: '',
    attendees: '',
    agenda: ['', '', ''],
    discussions: [
      { id: makeId(), title: '', notes: '' },
      { id: makeId(), title: '', notes: '' },
      { id: makeId(), title: '', notes: '' },
    ],
    actionItems: [
      { id: makeId(), action: '', owner: '', dueDate: '' },
      { id: makeId(), action: '', owner: '', dueDate: '' },
      { id: makeId(), action: '', owner: '', dueDate: '' },
    ],
    nextSteps: '',
    createdAt: now,
    updatedAt: now,
  }
}

function parseMeetingNotes(content: string | null, fallbackLanguage: Lang): MeetingContent {
  if (!content) return createEmptyMeetingNotes(fallbackLanguage)
  try {
    const parsed = JSON.parse(content) as Partial<MeetingContent>
    const fallback = createEmptyMeetingNotes(fallbackLanguage)
    return {
      ...fallback,
      ...parsed,
      language: parsed.language === 'en' || parsed.language === 'zh' ? parsed.language : fallbackLanguage,
      agenda: parsed.agenda?.length ? parsed.agenda : fallback.agenda,
      discussions: parsed.discussions?.length ? parsed.discussions : fallback.discussions,
      actionItems: parsed.actionItems?.length ? parsed.actionItems : fallback.actionItems,
    }
  } catch {
    const fallback = createEmptyMeetingNotes(fallbackLanguage)
    return { ...fallback, nextSteps: content }
  }
}

export function MeetingNotesEditor({ doc, onBack, onSaved }: Props) {
  const [content, setContent] = useState<MeetingContent>(() => parseMeetingNotes(doc.content, getStoredLanguage()))
  const [logoBase64, setLogoBase64] = useState('')
  const [companyName, setCompanyName] = useState('SOON Studio')
  const [saved, setSaved] = useState(false)
  const [draggedAgendaIndex, setDraggedAgendaIndex] = useState<number | null>(null)
  const [review, setReview] = useState<AiReview | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const c = copy[content.language]

  useEffect(() => {
    void loadSettings()
  }, [])

  async function loadSettings() {
    const { data } = await supabase
      .from('settings')
      .select('logo_base64, company_name')
      .eq('user_id', 'tommy')
      .maybeSingle()
    setLogoBase64(String(data?.logo_base64 ?? ''))
    setCompanyName(String(data?.company_name ?? 'SOON Studio'))
  }

  function update(patch: Partial<MeetingContent>) {
    setSaved(false)
    setContent((current) => ({ ...current, ...patch }))
  }

  function setLanguage(language: Lang) {
    window.localStorage.setItem(langStorageKey, language)
    update({ language, title: content.title || copy[language].title })
  }

  async function save() {
    const nextContent = { ...content, updatedAt: new Date().toISOString() }
    const { data, error } = await supabase
      .from('docs')
      .update({ title: nextContent.title || c.title, content: JSON.stringify(nextContent) })
      .eq('id', doc.id)
      .select()
      .single()
    if (error) {
      window.alert(error.message)
      return
    }
    setContent(nextContent)
    setSaved(true)
    onSaved(data as CoreDoc)
  }

  async function runReview() {
    setReviewing(true)
    try {
      const response = await fetch('/api/meeting-notes-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting: content }),
      })
      const data = (await response.json()) as AiReview & { error?: string }
      if (!response.ok || data.error) throw new Error(data.error || 'AI review failed')
      setReview(data)
    } catch (error) {
      setReview({ score: 0, overall: error instanceof Error ? error.message : 'AI review failed', issues: [] })
    } finally {
      setReviewing(false)
    }
  }

  function moveAgenda(targetIndex: number) {
    if (draggedAgendaIndex === null || draggedAgendaIndex === targetIndex) return
    const items = [...content.agenda]
    const [item] = items.splice(draggedAgendaIndex, 1)
    items.splice(targetIndex, 0, item)
    setDraggedAgendaIndex(null)
    update({ agenda: items })
  }

  function sectionIssues(section: string) {
    return review?.issues?.filter((issue) => issue.section === section) ?? []
  }

  function exportPdf() {
    window.print()
  }

  function exportWord() {
    const html = buildWordHtml(content, c)
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'meeting-notes.doc'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="script-editor-page meeting-notes-editor">
      <header className="brief-toolbar invoice-toolbar script-toolbar soon-no-print">
        <button type="button" onClick={onBack}>{c.back}</button>
        <div className="brief-language-toggle">
          {(['zh', 'en'] as Lang[]).map((language) => (
            <button key={language} type="button" className={content.language === language ? 'active' : ''} onClick={() => setLanguage(language)}>
              {language === 'zh' ? c.chinese : c.english}
            </button>
          ))}
        </div>
        <span className="toolbar-spacer" />
        {typeof review?.score === 'number' && <span className="script-score-badge" style={{ background: review.score >= 8 ? '#22c55e' : review.score >= 6 ? '#f59e0b' : '#ef4444' }}>AI {review.score}/10</span>}
        <button className="script-ai-review-button" type="button" disabled={reviewing} onClick={() => void runReview()}>
          {reviewing ? c.reviewing : c.ai}
        </button>
        {review && <button className="script-clear-review-button" type="button" onClick={() => setReview(null)}>{c.clearReview}</button>}
        <button className="export-button export-pdf-button" type="button" onClick={exportPdf}>{c.pdf}</button>
        <button className="export-button export-word-button" type="button" onClick={exportWord}>{c.word}</button>
        <button className="primary-button" type="button" onClick={() => void save()}>{c.save}</button>
        {saved && <span className="saved-indicator">{c.saved}</span>}
      </header>

      <article className="meeting-document soon-print-doc">
        <div className="doc-logo-area">
          {logoBase64 ? <img src={logoBase64} alt="" /> : <span>{companyName}</span>}
        </div>
        <input className="meeting-title-input" value={content.title} placeholder={c.title} onChange={(event) => update({ title: event.target.value })} />
        <p className="script-meta">{c.meta(formatDate(content.createdAt), formatDate(content.updatedAt))}</p>

        <MeetingSection title={c.overview}>
          <table className="brief-info-table">
            <tbody>
              <InfoRow label={c.date}><input type="date" value={content.date} onChange={(event) => update({ date: event.target.value })} /></InfoRow>
              <InfoRow label={c.meetingType}><input value={content.meetingType} placeholder={c.meetingTypePlaceholder} onChange={(event) => update({ meetingType: event.target.value })} /></InfoRow>
              <InfoRow label={c.facilitator}><input value={content.facilitator} placeholder={c.facilitatorPlaceholder} onChange={(event) => update({ facilitator: event.target.value })} /></InfoRow>
              <InfoRow label={c.attendees}><input value={content.attendees} placeholder={c.attendeesPlaceholder} onChange={(event) => update({ attendees: event.target.value })} /></InfoRow>
            </tbody>
          </table>
        </MeetingSection>

        <MeetingSection title={c.agenda} comments={sectionIssues('agenda')}>
          <div className="meeting-agenda-list">
            {content.agenda.map((item, index) => (
              <div key={index} className="meeting-agenda-row" draggable onDragStart={() => setDraggedAgendaIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveAgenda(index)}>
                <span>•</span>
                <input value={item} onChange={(event) => update({ agenda: content.agenda.map((current, itemIndex) => itemIndex === index ? event.target.value : current) })} />
                <button type="button" onClick={() => update({ agenda: content.agenda.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
              </div>
            ))}
          </div>
          <button className="add-row-button soon-no-print" type="button" onClick={() => update({ agenda: [...content.agenda, ''] })}>{c.addAgenda}</button>
        </MeetingSection>

        <MeetingSection title={c.discussion} comments={sectionIssues('discussion')}>
          <div className="meeting-topic-list">
            {content.discussions.map((topic) => (
              <div key={topic.id} className="meeting-topic-block">
                <button type="button" onClick={() => update({ discussions: content.discussions.filter((item) => item.id !== topic.id) })}>×</button>
                <input value={topic.title} placeholder="Topic title" onChange={(event) => update({ discussions: content.discussions.map((item) => item.id === topic.id ? { ...item, title: event.target.value } : item) })} />
                <textarea value={topic.notes} placeholder={c.discussionPlaceholder} rows={3} onChange={(event) => update({ discussions: content.discussions.map((item) => item.id === topic.id ? { ...item, notes: event.target.value } : item) })} />
                <div className="print-text">{topic.notes}</div>
              </div>
            ))}
          </div>
          <button className="add-row-button soon-no-print" type="button" onClick={() => update({ discussions: [...content.discussions, { id: makeId(), title: '', notes: '' }] })}>{c.addDiscussion}</button>
        </MeetingSection>

        <MeetingSection title={c.actionItems} comments={sectionIssues('action_items')}>
          <table className="meeting-action-table">
            <thead><tr><th>{c.action}</th><th>{c.owner}</th><th>{c.dueDate}</th><th /></tr></thead>
            <tbody>
              {content.actionItems.map((item) => (
                <tr key={item.id}>
                  <td><input value={item.action} placeholder={c.actionPlaceholder} onChange={(event) => update({ actionItems: content.actionItems.map((row) => row.id === item.id ? { ...row, action: event.target.value } : row) })} /></td>
                  <td><input value={item.owner} placeholder={c.ownerPlaceholder} onChange={(event) => update({ actionItems: content.actionItems.map((row) => row.id === item.id ? { ...row, owner: event.target.value } : row) })} /></td>
                  <td><input type="date" value={item.dueDate} onChange={(event) => update({ actionItems: content.actionItems.map((row) => row.id === item.id ? { ...row, dueDate: event.target.value } : row) })} /></td>
                  <td><button type="button" onClick={() => update({ actionItems: content.actionItems.filter((row) => row.id !== item.id) })}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="add-row-button soon-no-print" type="button" onClick={() => update({ actionItems: [...content.actionItems, { id: makeId(), action: '', owner: '', dueDate: '' }] })}>{c.addRow}</button>
        </MeetingSection>

        <MeetingSection title={c.nextSteps} comments={sectionIssues('next_steps')}>
          <textarea className="meeting-next-steps" value={content.nextSteps} placeholder={c.nextStepsPlaceholder} rows={3} onChange={(event) => update({ nextSteps: event.target.value })} />
          <div className="print-text">{content.nextSteps}</div>
        </MeetingSection>

        {review?.overall && <div className="script-clarity-card">{review.overall}</div>}
        {review?.missing && <div className="script-clarity-card">{review.missing}</div>}
        {review?.clarity && <div className="script-clarity-card">{review.clarity}</div>}
      </article>
    </section>
  )
}

function MeetingSection({ title, comments = [], children }: { title: string; comments?: AiIssue[]; children: React.ReactNode }) {
  return (
    <section className="meeting-section">
      <h2>{title}</h2>
      {children}
      {comments.map((comment, index) => (
        <div key={`${comment.section}-${index}`} className="ai-comment-box meeting-ai-comment">
          <p className="ai-comment-issue">⚠️ {comment.issue}</p>
          <p className="ai-comment-suggestion">💡 建議：{comment.suggestion}</p>
        </div>
      ))}
    </section>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <tr><th>{label}</th><td>{children}</td></tr>
}

function getStoredLanguage(): Lang {
  if (typeof window === 'undefined') return 'zh'
  return window.localStorage.getItem(langStorageKey) === 'en' ? 'en' : 'zh'
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-HK')
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char)
}

function buildWordHtml(content: MeetingContent, c: (typeof copy)[Lang]) {
  const agenda = content.agenda.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
  const discussions = content.discussions.map((item) => `<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.notes)}</p>`).join('')
  const actions = content.actionItems.map((item) => `<tr><td>${escapeHtml(item.action)}</td><td>${escapeHtml(item.owner)}</td><td>${escapeHtml(item.dueDate)}</td></tr>`).join('')
  return `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a}h1{font-size:28px}.meta{font-size:12px;color:#888;margin-bottom:24px}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border:1px solid #e5e5e5;padding:8px 12px;font-size:13px;text-align:left}p,li{font-size:13px;line-height:1.8;white-space:pre-wrap}</style></head><body><h1>${escapeHtml(content.title)}</h1><div class="meta">${escapeHtml(c.meta(formatDate(content.createdAt), formatDate(content.updatedAt)))}</div><table><tr><th>${c.date}</th><td>${content.date}</td></tr><tr><th>${c.meetingType}</th><td>${escapeHtml(content.meetingType)}</td></tr><tr><th>${c.facilitator}</th><td>${escapeHtml(content.facilitator)}</td></tr><tr><th>${c.attendees}</th><td>${escapeHtml(content.attendees)}</td></tr></table><h2>${c.agenda}</h2><ul>${agenda}</ul><h2>${c.discussion}</h2>${discussions}<h2>${c.actionItems}</h2><table><tr><th>${c.action}</th><th>${c.owner}</th><th>${c.dueDate}</th></tr>${actions}</table><h2>${c.nextSteps}</h2><p>${escapeHtml(content.nextSteps)}</p></body></html>`
}
