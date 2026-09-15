'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { TopicDirection, TopicItem, TopicSource, TopicStatus } from '@/lib/topic-library'

type Draft = {
  id: string
  slug: string
  title: string
  summary: string
  why_now: string
  hook: string
  suggested_angles: string
  direction_ids: string[]
  content_formats: string[]
  countries: string
  regions: string
  localities: string
  languages: string[]
  keywords: string
  cover_url: string
  cover_alt: string
  source_url: string
  source_name: string
  source_title: string
  source_text: string
  status: TopicStatus
  expires_at: string
}

const emptyDraft: Draft = {
  id: '',
  slug: '',
  title: '',
  summary: '',
  why_now: '',
  hook: '',
  suggested_angles: '',
  direction_ids: [],
  content_formats: ['carousel'],
  countries: '',
  regions: '',
  localities: '',
  languages: ['zh-HK'],
  keywords: '',
  cover_url: '',
  cover_alt: '',
  source_url: '',
  source_name: '',
  source_title: '',
  source_text: '',
  status: 'draft',
  expires_at: '',
}

const formatOptions = [
  { id: 'carousel', label: 'Carousel' },
  { id: 'short_video', label: 'Reel／短片' },
  { id: 'story', label: 'Story' },
  { id: 'threads', label: 'Threads' },
]

function splitLines(value: string) {
  return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
}

function topicToDraft(topic: TopicItem): Draft {
  const source = topic.topic_sources?.[0]
  return {
    id: topic.id,
    slug: topic.slug,
    title: topic.title,
    summary: topic.summary,
    why_now: topic.why_now,
    hook: topic.hook,
    suggested_angles: topic.suggested_angles.join('\n'),
    direction_ids: topic.topic_item_directions?.map((item) => item.direction_id) ?? [],
    content_formats: topic.content_formats,
    countries: topic.countries.join('，'),
    regions: topic.regions.join('，'),
    localities: topic.localities.join('，'),
    languages: topic.languages,
    keywords: topic.keywords.join('，'),
    cover_url: topic.cover_url ?? '',
    cover_alt: topic.cover_alt ?? '',
    source_url: source?.url ?? '',
    source_name: source?.source_name ?? '',
    source_title: source?.source_title ?? '',
    source_text: '',
    status: topic.status,
    expires_at: topic.expires_at ? topic.expires_at.slice(0, 16) : '',
  }
}

export function TopicLibraryAdmin() {
  const [topics, setTopics] = useState<TopicItem[]>([])
  const [directions, setDirections] = useState<TopicDirection[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [assisting, setAssisting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/topics/admin', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || '未能載入題材庫')
      setTopics(data.topics ?? [])
      setDirections(data.directions ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '未能載入題材庫')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const groupedDirections = useMemo(() => {
    const roots = directions.filter((item) => !item.parent_id)
    return roots.map((root) => ({
      root,
      children: directions.filter((item) => item.parent_id === root.id),
    }))
  }, [directions])

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function toggleArray(key: 'direction_ids' | 'content_formats' | 'languages', value: string, max = 20) {
    setDraft((current) => {
      const values = current[key]
      const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value].slice(0, max)
      return { ...current, [key]: next }
    })
  }

  function payload(status = draft.status) {
    const sources: TopicSource[] = draft.source_url ? [{
      url: draft.source_url,
      source_name: draft.source_name || null,
      source_title: draft.source_title || null,
    }] : []

    return {
      ...draft,
      status,
      suggested_angles: splitLines(draft.suggested_angles),
      countries: splitLines(draft.countries),
      regions: splitLines(draft.regions),
      localities: splitLines(draft.localities),
      keywords: splitLines(draft.keywords),
      expires_at: draft.expires_at || null,
      sources,
    }
  }

  async function save(nextStatus?: TopicStatus) {
    if (!draft.title.trim()) {
      setError('請先輸入題材標題')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/topics/admin', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(nextStatus)),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || '未能儲存題材')
      setDraft(topicToDraft(data.topic))
      setNotice(nextStatus === 'published' ? '題材已發布到中央 Topic API' : '題材已儲存')
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '未能儲存題材')
    } finally {
      setSaving(false)
    }
  }

  async function assist() {
    setAssisting(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/topics/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_url: draft.source_url,
          source_text: draft.source_text,
          title: draft.title,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'AI 整理失敗')
      const suggestion = data.suggestion ?? {}
      setDraft((current) => ({
        ...current,
        title: String(suggestion.title || current.title),
        summary: String(suggestion.summary || current.summary),
        why_now: String(suggestion.why_now || current.why_now),
        hook: String(suggestion.hook || current.hook),
        suggested_angles: Array.isArray(suggestion.suggested_angles) ? suggestion.suggested_angles.join('\n') : current.suggested_angles,
        direction_ids: Array.isArray(suggestion.direction_ids) ? suggestion.direction_ids.slice(0, 3) : current.direction_ids,
        content_formats: Array.isArray(suggestion.content_formats) ? suggestion.content_formats : current.content_formats,
        countries: Array.isArray(suggestion.countries) ? suggestion.countries.join('，') : current.countries,
        regions: Array.isArray(suggestion.regions) ? suggestion.regions.join('，') : current.regions,
        localities: Array.isArray(suggestion.localities) ? suggestion.localities.join('，') : current.localities,
        keywords: Array.isArray(suggestion.keywords) ? suggestion.keywords.join('，') : current.keywords,
      }))
      setNotice(data.source_read ? 'AI 已讀取來源並整理初稿，請人手核對後再發布' : '來源網站未能讀取，AI 已按現有資料提供保守建議')
    } catch (assistError) {
      setError(assistError instanceof Error ? assistError.message : 'AI 整理失敗')
    } finally {
      setAssisting(false)
    }
  }

  async function upload(file: File) {
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.set('file', file)
      const response = await fetch('/api/topics/upload', { method: 'POST', body: formData })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || '封面上載失敗')
      update('cover_url', data.url)
      setNotice('封面已上載；儲存題材後先會正式關聯')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '封面上載失敗')
    } finally {
      setUploading(false)
    }
  }

  async function removeTopic(topic: TopicItem) {
    if (!window.confirm(`確定刪除「${topic.title}」？`)) return
    setError('')
    const response = await fetch(`/api/topics/admin?id=${encodeURIComponent(topic.id)}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(data.error || '未能刪除題材')
      return
    }
    if (draft.id === topic.id) setDraft(emptyDraft)
    await load()
  }

  return (
    <main className="topic-admin">
      <header className="topic-admin-header">
        <div>
          <span>SOON.AI CONTENT INTELLIGENCE</span>
          <h1>題材資料庫</h1>
          <p>整理來源、建立 SOON 題材卡，再發布到網站及 App 共用嘅中央 API。</p>
        </div>
        <button type="button" className="secondary" onClick={() => setDraft(emptyDraft)}>＋ 新題材</button>
      </header>

      {error ? <div className="topic-message error" role="alert">{error}</div> : null}
      {notice ? <div className="topic-message success" role="status">{notice}</div> : null}

      <div className="topic-admin-grid">
        <aside className="topic-list">
          <div className="topic-list-title">
            <strong>題材</strong>
            <span>{loading ? '載入中…' : `${topics.length} 項`}</span>
          </div>
          {!loading && topics.length === 0 ? <p className="empty">未有題材，先建立第一張 SOON 題材卡。</p> : null}
          {topics.map((topic) => (
            <article key={topic.id} className={draft.id === topic.id ? 'active' : ''}>
              <button type="button" className="topic-open" onClick={() => setDraft(topicToDraft(topic))}>
                <span className="topic-card-image">
                  <span className="topic-card-fallback"><b>未有封面預覽</b><small>可繼續編輯題材</small></span>
                  {topic.cover_url ? <Image src={topic.cover_url} alt={topic.cover_alt || topic.title} fill sizes="(max-width: 760px) 100vw, 25vw" /> : null}
                </span>
                <span className="topic-card-copy">
                  <span className={`status ${topic.status}`}>{topic.status}</span>
                  <strong>{topic.title}</strong>
                  <small>{topic.topic_item_directions?.map((item) => item.topic_directions?.label_zh).filter(Boolean).join(' · ') || '未分類'}</small>
                  <em>{topic.summary || topic.hook || '未有摘要'}</em>
                  <time dateTime={topic.updated_at}>更新：{new Date(topic.updated_at).toLocaleDateString('zh-HK')}</time>
                </span>
              </button>
              <button type="button" className="topic-delete" aria-label={`刪除 ${topic.title}`} onClick={() => void removeTopic(topic)}>×</button>
            </article>
          ))}
        </aside>

        <section className="topic-editor">
          <div className="source-row">
            <label className="wide">
              <span>來源網址</span>
              <input value={draft.source_url} onChange={(event) => update('source_url', event.target.value)} placeholder="https://..." />
            </label>
            <button type="button" className="ai-button" disabled={assisting} onClick={() => void assist()}>
              {assisting ? 'AI 整理中…' : '✨ AI 整理初稿'}
            </button>
          </div>

          <label>
            <span>原始資料（可選）</span>
            <textarea rows={3} value={draft.source_text} onChange={(event) => update('source_text', event.target.value)} placeholder="如果網站讀唔到，可以貼入文章、IG caption 或筆記。只供 AI 整理，不會公開。" />
          </label>

          <div className="two-columns">
            <label><span>來源名稱</span><input value={draft.source_name} onChange={(event) => update('source_name', event.target.value)} placeholder="例如 A Day Magazine" /></label>
            <label><span>來源原標題</span><input value={draft.source_title} onChange={(event) => update('source_title', event.target.value)} /></label>
          </div>

          <label><span>SOON 題材標題 *</span><input value={draft.title} onChange={(event) => update('title', event.target.value)} /></label>
          <label><span>重點摘要</span><textarea rows={4} value={draft.summary} onChange={(event) => update('summary', event.target.value)} /></label>

          <div className="two-columns">
            <label><span>點解依家值得做</span><textarea rows={3} value={draft.why_now} onChange={(event) => update('why_now', event.target.value)} /></label>
            <label><span>建議 Hook</span><textarea rows={3} value={draft.hook} onChange={(event) => update('hook', event.target.value)} /></label>
          </div>
          <label><span>建議內容角度（每行一個）</span><textarea rows={4} value={draft.suggested_angles} onChange={(event) => update('suggested_angles', event.target.value)} /></label>

          <fieldset>
            <legend>Content Direction（最多 3 個，第一個為主要方向）</legend>
            <div className="direction-groups">
              {groupedDirections.map(({ root, children }) => (
                <div key={root.id}>
                  <strong>{root.label_zh}</strong>
                  <div className="chips">
                    {(children.length ? children : [root]).map((direction) => (
                      <button
                        key={direction.id}
                        type="button"
                        className={draft.direction_ids.includes(direction.id) ? 'selected' : ''}
                        disabled={!draft.direction_ids.includes(direction.id) && draft.direction_ids.length >= 3}
                        onClick={() => toggleArray('direction_ids', direction.id, 3)}
                      >
                        {direction.label_zh}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>建議內容形式</legend>
            <div className="chips">
              {formatOptions.map((format) => (
                <button key={format.id} type="button" className={draft.content_formats.includes(format.id) ? 'selected' : ''} onClick={() => toggleArray('content_formats', format.id)}>{format.label}</button>
              ))}
            </div>
          </fieldset>

          <div className="three-columns">
            <label><span>國家</span><input value={draft.countries} onChange={(event) => update('countries', event.target.value)} placeholder="Taiwan" /></label>
            <label><span>地區／城市</span><input value={draft.regions} onChange={(event) => update('regions', event.target.value)} placeholder="Tainan" /></label>
            <label><span>地點</span><input value={draft.localities} onChange={(event) => update('localities', event.target.value)} placeholder="Anping" /></label>
          </div>
          <label><span>關鍵字（逗號分隔）</span><input value={draft.keywords} onChange={(event) => update('keywords', event.target.value)} /></label>

          <div className="cover-section">
            <div className="cover-preview">
              {draft.cover_url ? <Image src={draft.cover_url} alt={draft.cover_alt || draft.title || '題材封面'} fill sizes="240px" /> : <span>封面預覽</span>}
            </div>
            <div>
              <label className="upload-button">
                {uploading ? '上載中…' : '上載一張封面相'}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void upload(file)
                  event.target.value = ''
                }} />
              </label>
              <label><span>圖片說明</span><input value={draft.cover_alt} onChange={(event) => update('cover_alt', event.target.value)} /></label>
              <label><span>到期時間（可選）</span><input type="datetime-local" value={draft.expires_at} onChange={(event) => update('expires_at', event.target.value)} /></label>
            </div>
          </div>

          <footer className="editor-actions">
            <span>目前狀態：{draft.status}</span>
            <div>
              <button type="button" className="secondary" disabled={saving} onClick={() => void save('draft')}>{saving ? '儲存中…' : '儲存草稿'}</button>
              <button type="button" className="primary" disabled={saving || !draft.cover_url} title={!draft.cover_url ? '發布前必須上載封面' : ''} onClick={() => void save('published')}>發布到中央 API</button>
            </div>
          </footer>
        </section>
      </div>

      <style jsx>{`
        .topic-admin { min-height: 100vh; background: #0a0a0a; color: #f5f5f5; padding: 32px; }
        .topic-admin-header { display: flex; justify-content: space-between; gap: 24px; align-items: end; max-width: 1500px; margin: 0 auto 24px; }
        .topic-admin-header span { color: #a78bfa; font-size: 11px; letter-spacing: .14em; font-weight: 700; }
        h1 { margin: 6px 0; font-size: 30px; }
        .topic-admin-header p { margin: 0; color: #888; }
        button { border: 0; }
        .secondary, .primary, .ai-button { border-radius: 9px; padding: 10px 15px; font-weight: 650; }
        .secondary { background: #242424; color: #eee; border: 1px solid rgba(255,255,255,.1); }
        .primary, .ai-button { background: #7c3aed; color: white; }
        button:disabled { cursor: not-allowed; opacity: .45; }
        .topic-message { max-width: 1500px; margin: 0 auto 16px; border-radius: 10px; padding: 11px 14px; font-size: 13px; }
        .topic-message.error { background: rgba(239,68,68,.14); color: #fca5a5; }
        .topic-message.success { background: rgba(52,211,153,.12); color: #6ee7b7; }
        .topic-admin-grid { max-width: 1500px; margin: auto; display: grid; gap: 18px; }
        .topic-list, .topic-editor { border: 1px solid rgba(255,255,255,.08); background: #141414; border-radius: 14px; }
        .topic-list { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px; padding: 16px; }
        .topic-list-title { grid-column: 1/-1; display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,.08); }
        .topic-list-title span, .empty { color: #777; font-size: 12px; }
        .empty { grid-column: 1/-1; padding: 16px; }
        .topic-list article { position: relative; min-width: 0; overflow: hidden; border: 1px solid rgba(255,255,255,.09); border-radius: 13px; background: #1d1a20; }
        .topic-list article.active { border-color: #a855f7; box-shadow: 0 0 0 1px rgba(168,85,247,.25); }
        .topic-open { width: 100%; display: grid; text-align: left; color: inherit; background: transparent; }
        .topic-card-image { position: relative; display: grid; aspect-ratio: 1/1; place-items: center; overflow: hidden; background: radial-gradient(circle at 30% 20%,#392345,#17131b 70%); }
        .topic-card-image :global(img) { object-fit: cover; }
        .topic-card-fallback { display: grid; gap: 5px; place-items: center; color: #8d7696; }
        .topic-card-fallback b { color: #bda7c6; font-size: 12px; }
        .topic-card-fallback small { color: #75627d; font-size: 10px; }
        .topic-card-copy { display: grid; gap: 7px; padding: 13px; }
        .topic-card-copy strong { line-height: 1.4; padding-right: 22px; }
        .topic-card-copy small { color: #a78bfa; }
        .topic-card-copy em { min-height: 3em; display: -webkit-box; overflow: hidden; color: #aaa; font-size: 11px; font-style: normal; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
        .topic-card-copy time { color: #666; font-size: 10px; }
        .status { justify-self: start; border-radius: 99px; padding: 3px 7px; background: #2b2b2b; color: #aaa; font-size: 10px; text-transform: uppercase; }
        .status.published { color: #6ee7b7; background: rgba(52,211,153,.1); }
        .topic-delete { position: absolute; right: 9px; bottom: 78px; z-index: 2; width: 28px; height: 28px; border-radius: 999px; background: rgba(10,10,10,.75); color: #aaa; font-size: 18px; }
        .topic-editor { padding: 22px; display: grid; gap: 17px; }
        label { display: grid; gap: 7px; }
        label > span, legend { color: #aaa; font-size: 12px; font-weight: 650; }
        input, textarea { width: 100%; border: 1px solid rgba(255,255,255,.09); border-radius: 9px; background: #1c1c1c; color: white; padding: 11px 12px; outline: none; resize: vertical; }
        input:focus, textarea:focus { border-color: #7c3aed; }
        .source-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: end; }
        .two-columns, .three-columns { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }
        .three-columns { grid-template-columns: repeat(3,minmax(0,1fr)); }
        fieldset { margin: 0; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 14px; }
        legend { padding: 0 7px; }
        .direction-groups { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 14px; }
        .direction-groups strong { display: block; margin-bottom: 8px; font-size: 12px; }
        .chips { display: flex; flex-wrap: wrap; gap: 7px; }
        .chips button { border-radius: 99px; padding: 7px 10px; background: #242424; color: #aaa; font-size: 12px; }
        .chips button.selected { background: #7c3aed; color: white; }
        .cover-section { display: grid; grid-template-columns: 240px minmax(0,1fr); gap: 18px; }
        .cover-section > div:last-child { display: grid; gap: 13px; align-content: start; }
        .cover-preview { position: relative; aspect-ratio: 4/5; overflow: hidden; border-radius: 12px; background: #1c1c1c; display: grid; place-items: center; color: #555; }
        .cover-preview :global(img) { object-fit: cover; }
        .upload-button { justify-items: center; cursor: pointer; border: 1px dashed rgba(255,255,255,.18); border-radius: 9px; padding: 12px; color: #a78bfa; }
        .upload-button input { display: none; }
        .editor-actions { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,.08); padding-top: 18px; }
        .editor-actions > span { color: #777; font-size: 12px; }
        .editor-actions > div { display: flex; gap: 9px; }
        @media (max-width: 1100px) {
          .topic-list { grid-template-columns: repeat(3,minmax(0,1fr)); }
        }
        @media (max-width: 900px) {
          .topic-list { grid-template-columns: repeat(2,minmax(0,1fr)); }
        }
        @media (max-width: 760px) {
          .topic-admin { padding: 18px; }
          .topic-list { grid-template-columns: 1fr; }
          .topic-admin-header, .editor-actions { align-items: stretch; flex-direction: column; }
          .source-row, .two-columns, .three-columns, .direction-groups, .cover-section { grid-template-columns: 1fr; }
          .cover-preview { width: min(100%, 260px); }
          .editor-actions > div { display: grid; }
        }
      `}</style>
    </main>
  )
}
