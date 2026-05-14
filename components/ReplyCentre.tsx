'use client'

import { useEffect, useMemo, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import { supabase } from '@/lib/supabase'

type InboxType = 'email' | 'message' | 'fans'
type ReplyStatus = 'pending' | 'replied' | 'follow_up' | 'important' | 'done'
type ReplyTone = 'professional' | 'friendly' | 'casual'
type ReplyLength = 'brief' | 'standard' | 'detailed'

type ReplyThread = {
  id: string
  workspace_id: string | null
  inbox_type: InboxType
  sender_name: string | null
  sender_handle: string | null
  original_message: string
  ai_reply: string | null
  user_edited_reply: string | null
  status: ReplyStatus
  tags: string[] | null
  notes: string | null
  follow_up_date: string | null
  created_at: string
  updated_at: string
}

type ReplySetting = {
  id?: string
  user_id: string
  inbox_type: InboxType
  assistant_name: string
  tone: ReplyTone
  reply_length: ReplyLength
  creator_context: string
  avoid_topics: string
}

type NewMessageDraft = {
  inbox_type: InboxType
  sender_name: string
  sender_handle: string
  original_message: string
}

const inboxTabs: Array<{ value: InboxType; label: string; icon: string }> = [
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'message', label: 'Message', icon: '💬' },
  { value: 'fans', label: 'Fans', icon: '👥' },
]

const statusMeta: Record<ReplyStatus, { label: string; color: string }> = {
  pending: { label: '待跟進', color: '#f59e0b' },
  follow_up: { label: '待跟進', color: '#f59e0b' },
  replied: { label: '已回覆', color: '#22c55e' },
  important: { label: '重要', color: '#ef4444' },
  done: { label: '已完成', color: '#6b7280' },
}

const statusOptions: Array<{ value: ReplyStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待跟進' },
  { value: 'replied', label: '已回覆' },
  { value: 'important', label: '重要' },
  { value: 'done', label: '已完成' },
]

const tagOptions = ['合作查詢', '粉絲問題', '媒體查詢', '其他']
const tagColors: Record<string, string> = {
  合作查詢: '#7c3aed',
  粉絲問題: '#ec4899',
  媒體查詢: '#0ea5e9',
  其他: '#6b7280',
}

const defaultSettings = (inboxType: InboxType): ReplySetting => ({
  user_id: 'tommy',
  inbox_type: inboxType,
  assistant_name: 'Mayan',
  tone: 'friendly',
  reply_length: 'standard',
  creator_context: '',
  avoid_topics: '',
})

const emptyDraft: NewMessageDraft = {
  inbox_type: 'email',
  sender_name: '',
  sender_handle: '',
  original_message: '',
}

export function ReplyCentre() {
  const [threads, setThreads] = useState<ReplyThread[]>([])
  const [settings, setSettings] = useState<Record<InboxType, ReplySetting>>({
    email: defaultSettings('email'),
    message: defaultSettings('message'),
    fans: defaultSettings('fans'),
  })
  const [activeInbox, setActiveInbox] = useState<InboxType>('email')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<NewMessageDraft>(emptyDraft)
  const [statusFilter, setStatusFilter] = useState<ReplyStatus | 'all'>('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editedReply, setEditedReply] = useState('')
  const [notes, setNotes] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [status, setStatus] = useState<ReplyStatus>('pending')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void loadReplyData()
  }, [])

  const selectedThread = useMemo(() => threads.find((thread) => thread.id === selectedId) ?? null, [selectedId, threads])

  useEffect(() => {
    if (!selectedThread) return
    setEditedReply(selectedThread.user_edited_reply || selectedThread.ai_reply || '')
    setNotes(selectedThread.notes || '')
    setFollowUpDate(selectedThread.follow_up_date || '')
    setTags(selectedThread.tags || [])
    setStatus(selectedThread.status || 'pending')
  }, [selectedThread])

  async function loadReplyData() {
    const [{ data: threadData }, { data: settingsData }] = await Promise.all([
      supabase.from('reply_threads').select('*').order('updated_at', { ascending: false }),
      supabase.from('reply_settings').select('*').eq('user_id', 'tommy'),
    ])

    const nextSettings = {
      email: defaultSettings('email'),
      message: defaultSettings('message'),
      fans: defaultSettings('fans'),
    }
    ;((settingsData ?? []) as ReplySetting[]).forEach((setting) => {
      nextSettings[setting.inbox_type] = { ...defaultSettings(setting.inbox_type), ...setting }
    })
    setSettings(nextSettings)
    setThreads((threadData ?? []) as ReplyThread[])

    const missing = inboxTabs
      .map((tab) => tab.value)
      .filter((inbox) => !(settingsData ?? []).some((setting) => setting.inbox_type === inbox))
      .map((inbox) => defaultSettings(inbox))
    if (missing.length > 0) {
      await supabase.from('reply_settings').upsert(missing, { onConflict: 'user_id,inbox_type' })
    }
  }

  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      if (thread.inbox_type !== activeInbox) return false
      if (statusFilter !== 'all' && thread.status !== statusFilter && !(statusFilter === 'pending' && thread.status === 'follow_up')) return false
      if (tagFilter !== 'all' && !(thread.tags ?? []).includes(tagFilter)) return false
      if (search.trim()) {
        const haystack = `${thread.sender_name ?? ''} ${thread.sender_handle ?? ''} ${thread.original_message}`.toLowerCase()
        if (!haystack.includes(search.trim().toLowerCase())) return false
      }
      return true
    })
  }, [activeInbox, search, statusFilter, tagFilter, threads])

  const counts = useMemo(() => {
    return inboxTabs.reduce<Record<InboxType, number>>((acc, tab) => {
      acc[tab.value] = threads.filter((thread) => thread.inbox_type === tab.value && (thread.status === 'pending' || thread.status === 'follow_up')).length
      return acc
    }, { email: 0, message: 0, fans: 0 })
  }, [threads])

  async function generateReplyForMessage(originalMessage: string, inboxType: InboxType) {
    setGenerating(true)
    try {
      const response = await fetch('/api/reply-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_message: originalMessage,
          creator_name: 'Tommy',
          settings: settings[inboxType],
        }),
      })
      const data = await response.json() as { reply?: string; error?: string }
      if (!response.ok || data.error) throw new Error(data.error || 'AI reply failed')
      return data.reply || ''
    } finally {
      setGenerating(false)
    }
  }

  async function createThreadWithReply() {
    if (!draft.original_message.trim()) {
      window.alert('請貼入原始訊息')
      return
    }
    const aiReply = await generateReplyForMessage(draft.original_message, draft.inbox_type)
    const { data, error } = await supabase
      .from('reply_threads')
      .insert({
        inbox_type: draft.inbox_type,
        sender_name: draft.sender_name.trim() || '未命名',
        sender_handle: draft.sender_handle.trim() || null,
        original_message: draft.original_message.trim(),
        ai_reply: aiReply,
        user_edited_reply: aiReply,
        status: 'pending',
        tags: [],
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) {
      window.alert(error.message)
      return
    }
    setThreads((current) => [data as ReplyThread, ...current])
    setSelectedId((data as ReplyThread).id)
    setActiveInbox(draft.inbox_type)
    setCreating(false)
    setDraft(emptyDraft)
  }

  async function regenerateReply() {
    if (!selectedThread) return
    const reply = await generateReplyForMessage(selectedThread.original_message, selectedThread.inbox_type)
    setEditedReply(reply)
    const { data, error } = await supabase
      .from('reply_threads')
      .update({ ai_reply: reply, user_edited_reply: reply, updated_at: new Date().toISOString() })
      .eq('id', selectedThread.id)
      .select()
      .single()
    if (!error && data) setThreads((current) => current.map((thread) => thread.id === selectedThread.id ? data as ReplyThread : thread))
  }

  async function saveThread(nextStatus = status) {
    if (!selectedThread) return
    const payload = {
      status: nextStatus,
      tags,
      notes: notes.trim() || null,
      follow_up_date: nextStatus === 'follow_up' ? followUpDate || null : null,
      user_edited_reply: editedReply,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('reply_threads').update(payload).eq('id', selectedThread.id).select().single()
    if (error) {
      window.alert(error.message)
      return
    }
    setThreads((current) => current.map((thread) => thread.id === selectedThread.id ? data as ReplyThread : thread))
    setStatus(nextStatus)
  }

  async function copyReply() {
    await navigator.clipboard.writeText(editedReply)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  function toggleTag(tag: string) {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])
  }

  return (
    <DashboardShell activeSection="reply">
      <section className="reply-page">
        <aside className="reply-list-panel">
          <div className="reply-list-top">
            <h1>回覆中心</h1>
            <button type="button" onClick={() => { setCreating(true); setSelectedId(null) }}>+ 新增訊息</button>
          </div>

          <div className="reply-inbox-tabs">
            {inboxTabs.map((tab) => (
              <button key={tab.value} className={activeInbox === tab.value ? 'active' : ''} type="button" onClick={() => setActiveInbox(tab.value)}>
                {tab.icon} {tab.label}<span>{counts[tab.value]}</span>
              </button>
            ))}
          </div>

          <div className="reply-filter-bar">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ReplyStatus | 'all')}>
              {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="all">全部標籤</option>
              {tagOptions.map((tag) => <option key={tag}>{tag}</option>)}
            </select>
            <input value={search} placeholder="搜尋訊息..." onChange={(event) => setSearch(event.target.value)} />
          </div>

          <div className="reply-thread-list">
            {filteredThreads.map((thread) => (
              <button key={thread.id} className={`reply-thread-card ${thread.id === selectedId ? 'active' : ''} ${thread.status === 'pending' ? 'unread' : ''}`} type="button" onClick={() => { setSelectedId(thread.id); setCreating(false) }}>
                <span className="reply-dot" />
                <strong>{thread.sender_name || '未命名'}</strong>
                <p>{thread.original_message.slice(0, 60)}{thread.original_message.length > 60 ? '...' : ''}</p>
                <div>
                  <small>{formatTimeAgo(thread.updated_at || thread.created_at)}</small>
                  <StatusPill status={thread.status} />
                </div>
                {(thread.tags ?? []).length > 0 && <div className="reply-tag-row">{(thread.tags ?? []).map((tag) => <TagPill key={tag} tag={tag} />)}</div>}
              </button>
            ))}
            {filteredThreads.length === 0 && <div className="reply-empty-list">未有訊息</div>}
          </div>
        </aside>

        <main className="reply-detail-panel">
          {creating ? (
            <NewMessagePanel draft={draft} generating={generating} onChange={setDraft} onGenerate={() => void createThreadWithReply()} />
          ) : selectedThread ? (
            <article className="reply-detail-card">
              <header className="reply-detail-head">
                <div>
                  <h2>{selectedThread.sender_name || '未命名'}</h2>
                  <p>{selectedThread.sender_handle || '未有 handle'} · {formatTimeAgo(selectedThread.created_at)}</p>
                  <span className="reply-inbox-badge">{inboxTabs.find((tab) => tab.value === selectedThread.inbox_type)?.icon} {selectedThread.inbox_type}</span>
                </div>
                <div className="reply-detail-actions">
                  <select value={status} onChange={(event) => setStatus(event.target.value as ReplyStatus)}>
                    {Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                  </select>
                </div>
              </header>

              <section>
                <label className="reply-section-label">原始訊息 / Original Message</label>
                <div className="reply-original-message">{selectedThread.original_message}</div>
              </section>

              <section>
                <label className="reply-section-label">AI 回覆建議（{settings[selectedThread.inbox_type].assistant_name || 'Mayan'}）</label>
                <textarea className="reply-ai-textarea" value={editedReply} onChange={(event) => setEditedReply(event.target.value)} />
                <div className="reply-button-row">
                  <button type="button" onClick={() => void copyReply()}>📋 複製回覆</button>
                  <button type="button" disabled={generating} onClick={() => void regenerateReply()}>{generating ? '生成中...' : '🔄 重新生成'}</button>
                  <button type="button" onClick={() => void saveThread('replied')}>✅ 標記已回覆</button>
                  {copied && <span>已複製！</span>}
                </div>
              </section>

              <section className="reply-tag-picker">
                <label className="reply-section-label">Tags</label>
                <div>
                  {tagOptions.map((tag) => <button key={tag} className={tags.includes(tag) ? 'active' : ''} style={tags.includes(tag) ? { background: tagColors[tag] } : undefined} type="button" onClick={() => toggleTag(tag)}>{tag}</button>)}
                </div>
              </section>

              <section className="reply-follow-up">
                <label className="reply-checkbox-row">
                  <input checked={status === 'follow_up'} type="checkbox" onChange={(event) => setStatus(event.target.checked ? 'follow_up' : 'pending')} />
                  📌 需要跟進
                </label>
                {status === 'follow_up' && <label>跟進日期<input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /></label>}
                <label>備注<textarea value={notes} placeholder="備注" onChange={(event) => setNotes(event.target.value)} /></label>
              </section>

              <button className="reply-save-button" type="button" onClick={() => void saveThread()}>儲存</button>
            </article>
          ) : (
            <div className="reply-empty-state">選擇一條訊息開始</div>
          )}
        </main>
      </section>
    </DashboardShell>
  )
}

function NewMessagePanel({ draft, generating, onChange, onGenerate }: { draft: NewMessageDraft; generating: boolean; onChange: (draft: NewMessageDraft) => void; onGenerate: () => void }) {
  return (
    <article className="reply-new-panel">
      <h2>新增訊息</h2>
      <div className="reply-type-toggle">
        {inboxTabs.map((tab) => <button key={tab.value} className={draft.inbox_type === tab.value ? 'active' : ''} type="button" onClick={() => onChange({ ...draft, inbox_type: tab.value })}>{tab.icon} {tab.label}</button>)}
      </div>
      <label>Sender name<input value={draft.sender_name} placeholder="發送者名稱" onChange={(event) => onChange({ ...draft, sender_name: event.target.value })} /></label>
      <label>Sender handle<input value={draft.sender_handle} placeholder="@handle 或 email" onChange={(event) => onChange({ ...draft, sender_handle: event.target.value })} /></label>
      <label>Original message<textarea value={draft.original_message} placeholder="將收到嘅訊息貼入呢度..." rows={8} onChange={(event) => onChange({ ...draft, original_message: event.target.value })} /></label>
      <button className="reply-save-button" type="button" disabled={generating} onClick={onGenerate}>{generating ? '生成中...' : '✨ AI 生成回覆'}</button>
    </article>
  )
}

function StatusPill({ status }: { status: ReplyStatus }) {
  const meta = statusMeta[status] ?? statusMeta.pending
  return <span className="reply-status-pill" style={{ background: meta.color }}>{meta.label}</span>
}

function TagPill({ tag }: { tag: string }) {
  return <span className="reply-tag-pill" style={{ background: tagColors[tag] ?? '#6b7280' }}>{tag}</span>
}

function formatTimeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.max(1, Math.floor(diff / 60000))
  if (minutes < 60) return `${minutes} 分鐘前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小時前`
  return `${Math.floor(hours / 24)} 日前`
}
