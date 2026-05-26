'use client'

import type { ChangeEvent } from 'react'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { DashboardShell } from '@/components/DashboardShell'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAILS = [
  'tsangtakyun@gmail.com',
]

type TrendAngle = {
  name: string
  emoji: string
  percentage: number
}

type Trend = {
  id: string
  icon: string | null
  topic: string
  category?: string | null
  keywords?: string | null
  heat_score: number
  angles: TrendAngle[] | null
  is_active: boolean
  deadline_at?: string | null
  deadline_timezone?: string | null
  news_headlines?: NewsHeadline[] | null
  description?: string | null
  why_trending?: string | null
  creator_tips?: string | null
  related_links?: Array<{ url?: string }> | null
}

type TrendDraft = {
  icon: string
  topic: string
  category: string
  keywords: string
  heat_score: number
  is_active: boolean
  angles: TrendAngle[]
}

type DetailField = 'description' | 'why_trending' | 'creator_tips'
type NewsHeadline = {
  title: string
  source?: string
  url?: string
  published_at?: string | null
}

const categoryOptions = [
  { value: 'news', label: '新聞' },
  { value: 'finance', label: '財經' },
  { value: 'tech', label: '科技' },
  { value: 'life', label: '生活' },
  { value: 'sports', label: '體育' },
  { value: 'gaming', label: '遊戲' },
  { value: 'anime', label: '動漫' },
  { value: 'entertainment', label: '娛樂' },
]

const timezoneOptions = [
  { value: 'Asia/Hong_Kong', label: '香港 HKT' },
  { value: 'Europe/London', label: '倫敦 GMT/BST' },
  { value: 'Europe/Paris', label: '巴黎 CET/CEST' },
  { value: 'Asia/Tokyo', label: '東京 JST' },
  { value: 'Asia/Taipei', label: '台北 CST' },
  { value: 'Asia/Singapore', label: '新加坡 SGT' },
  { value: 'America/New_York', label: '紐約 ET' },
]

const emptyDraft: TrendDraft = {
  icon: '⚽',
  topic: '',
  category: 'news',
  keywords: '',
  heat_score: 50,
  is_active: true,
  angles: [{ emoji: '💬', name: '', percentage: 100 }],
}

function parseAngles(value: unknown): TrendAngle[] {
  if (!Array.isArray(value)) return []
  return value.map((angle) => {
    const item = angle as Partial<TrendAngle>
    return {
      emoji: String(item.emoji ?? '💬'),
      name: String(item.name ?? ''),
      percentage: Number(item.percentage ?? 0),
    }
  })
}

function clampScore(value: number) {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function normaliseAngles(angles: TrendAngle[]) {
  const cleanAngles = angles
    .map((angle) => ({
      emoji: angle.emoji || '💬',
      name: angle.name.trim(),
      percentage: Math.max(0, Number(angle.percentage) || 0),
    }))
    .filter((angle) => angle.name)

  if (cleanAngles.length === 0) return []

  const total = cleanAngles.reduce((sum, angle) => sum + angle.percentage, 0)
  if (total === 100) return cleanAngles
  if (total === 0) {
    const base = Math.floor(100 / cleanAngles.length)
    return cleanAngles.map((angle, index) => ({
      ...angle,
      percentage: index === cleanAngles.length - 1 ? 100 - base * (cleanAngles.length - 1) : base,
    }))
  }

  let runningTotal = 0
  return cleanAngles.map((angle, index) => {
    if (index === cleanAngles.length - 1) return { ...angle, percentage: 100 - runningTotal }
    const percentage = Math.round((angle.percentage / total) * 100)
    runningTotal += percentage
    return { ...angle, percentage }
  })
}

function isImageIcon(value: string | null | undefined) {
  return Boolean(value && (/^(https?:|data:image\/)/.test(value)))
}

function toDatetimeLocalValue(value: string | null | undefined, timeZone = 'Asia/Hong_Kong') {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

function parseNewsHeadlines(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return { title: item.trim() }
      const news = item as Partial<NewsHeadline>
      return {
        title: String(news.title ?? '').trim(),
        source: typeof news.source === 'string' ? news.source : '',
        url: typeof news.url === 'string' ? news.url : '',
        published_at: typeof news.published_at === 'string' ? news.published_at : null,
      }
    })
    .filter((item) => item.title)
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('讀取圖片失敗'))
    reader.readAsDataURL(file)
  })
}

function IconPreview({ value, size = 34 }: { value?: string | null; size?: number }) {
  if (isImageIcon(value)) {
    return (
      <img
        src={value || ''}
        alt=""
        style={{
          borderRadius: Math.round(size * 0.22),
          display: 'block',
          height: size,
          objectFit: 'cover',
          width: size,
        }}
      />
    )
  }

  return (
    <span style={{ fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif', fontSize: Math.round(size * 0.72), lineHeight: 1 }}>
      {value || '💬'}
    </span>
  )
}

export default function PrediktPage() {
  return (
    <Suspense>
      <PrediktClient />
    </Suspense>
  )
}

function PrediktClient() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [trends, setTrends] = useState<Trend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingTrend, setEditingTrend] = useState<Trend | null>(null)
  const [draft, setDraft] = useState<TrendDraft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [fetchingNews, setFetchingNews] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [description, setDescription] = useState('')
  const [whyTrending, setWhyTrending] = useState('')
  const [creatorTips, setCreatorTips] = useState('')
  const [relatedLinksText, setRelatedLinksText] = useState('')
  const [deadlineAt, setDeadlineAt] = useState('')
  const [deadlineTimezone, setDeadlineTimezone] = useState('Asia/Hong_Kong')
  const [newsItems, setNewsItems] = useState<NewsHeadline[]>([])
  const [generatingField, setGeneratingField] = useState<DetailField | null>(null)

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const nextIsAdmin = ADMIN_EMAILS.includes(user?.email ?? '')
      setIsAdmin(nextIsAdmin)
      setAuthChecked(true)
      if (!nextIsAdmin) router.replace('/')
    }

    void checkAdmin()
  }, [router])

  useEffect(() => {
    if (isAdmin) void loadTrends()
  }, [isAdmin])

  const angleTotal = useMemo(
    () => draft.angles.reduce((sum, angle) => sum + (Number(angle.percentage) || 0), 0),
    [draft.angles]
  )

  async function callTrendsApi(method: string, body?: Record<string, unknown>, query = '') {
    const response = await fetch(`/api/predikt/trends${query}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Predikt request failed')
    return data
  }

  async function loadTrends() {
    setLoading(true)
    setError('')

    try {
      const data = await callTrendsApi('GET')
      setTrends((data.trends ?? []).map((trend: Trend) => ({
        ...trend,
        angles: parseAngles(trend.angles),
      })))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '載入失敗')
      setTrends([])
    }

    setLoading(false)
  }

  function openCreateModal() {
    setEditingTrend(null)
    setDraft(emptyDraft)
    resetDetailFields()
    setShowModal(true)
  }

  function openEditModal(trend: Trend) {
    setEditingTrend(trend)
    setDraft({
      icon: trend.icon || '💬',
      topic: trend.topic || '',
      category: trend.category || 'news',
      keywords: trend.keywords || '',
      heat_score: clampScore(Number(trend.heat_score ?? 0)),
      is_active: Boolean(trend.is_active),
      angles: parseAngles(trend.angles),
    })
    setDescription(trend.description || '')
    setWhyTrending(trend.why_trending || '')
    setCreatorTips(trend.creator_tips || '')
    setRelatedLinksText((trend.related_links || []).map((link) => link.url).filter(Boolean).join('\n'))
    setDeadlineTimezone(trend.deadline_timezone || 'Asia/Hong_Kong')
    setDeadlineAt(toDatetimeLocalValue(trend.deadline_at, trend.deadline_timezone || 'Asia/Hong_Kong'))
    setNewsItems(parseNewsHeadlines(trend.news_headlines))
    setShowDetail(Boolean(trend.description || trend.why_trending || trend.creator_tips || (trend.related_links || []).length > 0 || parseNewsHeadlines(trend.news_headlines).length > 0))
    setShowModal(true)
  }

  function patchTrendLocal(id: string, patch: Partial<Trend>) {
    setTrends((current) => current.map((trend) => trend.id === id ? { ...trend, ...patch } : trend))
  }

  async function toggleActive(trend: Trend) {
    const nextActive = !trend.is_active
    patchTrendLocal(trend.id, { is_active: nextActive })

    try {
      await callTrendsApi('PATCH', { id: trend.id, is_active: nextActive })
    } catch (updateError) {
      window.alert('更新狀態失敗：' + (updateError instanceof Error ? updateError.message : '未知錯誤'))
      patchTrendLocal(trend.id, { is_active: trend.is_active })
    }
  }

  async function saveHeatScore(trend: Trend) {
    try {
      await callTrendsApi('PATCH', { id: trend.id, heat_score: clampScore(Number(trend.heat_score ?? 0)) })
    } catch (updateError) {
      window.alert('更新 Heat Score 失敗：' + (updateError instanceof Error ? updateError.message : '未知錯誤'))
      void loadTrends()
    }
  }

  async function deleteTrend(trend: Trend) {
    if (!window.confirm(`確定刪除「${trend.topic}」？此操作不可復原。`)) return

    setTrends((current) => current.filter((item) => item.id !== trend.id))
    try {
      await callTrendsApi('DELETE', undefined, `?id=${encodeURIComponent(trend.id)}`)
    } catch (deleteError) {
      window.alert('刪除失敗：' + (deleteError instanceof Error ? deleteError.message : '未知錯誤'))
      void loadTrends()
    }
  }

  async function saveTrend() {
    if (!draft.topic.trim()) {
      window.alert('請輸入話題名稱')
      return
    }

    setSaving(true)
    const payload = {
      icon: draft.icon.trim() || '💬',
      topic: draft.topic.trim(),
      category: draft.category,
      keywords: draft.keywords.trim() || null,
      heat_score: clampScore(Number(draft.heat_score)),
      is_active: draft.is_active,
      angles: normaliseAngles(draft.angles),
      deadline_at: deadlineAt || null,
      deadline_timezone: deadlineTimezone,
      news_headlines: newsItems.filter((item) => item.title.trim()).map((item) => ({
        title: item.title.trim(),
        source: item.source?.trim() || '',
        url: item.url?.trim() || '',
        published_at: item.published_at || null,
      })),
      description: description.trim() || null,
      why_trending: whyTrending.trim() || null,
      creator_tips: creatorTips.trim() || null,
      related_links: relatedLinksText
        ? relatedLinksText.split('\n').map((url) => url.trim()).filter(Boolean).map((url) => ({ url }))
        : [],
    }

    try {
      if (editingTrend) {
        await callTrendsApi('PATCH', { id: editingTrend.id, ...payload })
      } else {
        await callTrendsApi('POST', payload)
      }
      closeModal()
      await loadTrends()
    } catch (saveError) {
      window.alert('儲存失敗：' + (saveError instanceof Error ? saveError.message : '未知錯誤'))
    } finally {
      setSaving(false)
    }
  }

  async function fetchNews() {
    if (!draft.topic.trim() && !draft.keywords.trim()) {
      window.alert('請先輸入話題名稱或搜尋關鍵字')
      return
    }

    setFetchingNews(true)
    try {
      const response = await fetch('/api/predikt/fetch-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: draft.keywords, topic: draft.topic }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || '抓取新聞失敗')
      setNewsItems(parseNewsHeadlines(data.items))
    } catch (fetchError) {
      window.alert('抓取新聞失敗：' + (fetchError instanceof Error ? fetchError.message : '未知錯誤'))
    } finally {
      setFetchingNews(false)
    }
  }

  function patchNewsItem(index: number, patch: Partial<NewsHeadline>) {
    setNewsItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  async function generateWithAI(field: DetailField) {
    if (!draft.topic.trim()) return

    setGeneratingField(field)

    const prompts: Record<DetailField, string> = {
      description: `你係一個香港內容創作顧問。
根據以下話題，寫一段100-150字嘅背景介紹，用繁體中文廣東話書面語。
話題：${draft.topic}
討論角度：${draft.angles.map((angle) => angle.name).filter(Boolean).join('、')}

只返回背景介紹文字，唔需要標題或其他說明。`,

      why_trending: `你係一個香港社交媒體分析師。
解釋點解「${draft.topic}」呢個話題而家咁受香港/亞洲創作者關注，
100字左右，用繁體中文廣東話書面語。
只返回分析文字，唔需要標題。`,

      creator_tips: `你係一個香港短片創作顧問。
針對「${draft.topic}」呢個話題，
俾3-4個具體嘅拍攝建議俾 IG Reel / YouTube Shorts creator，
每個建議一行，用繁體中文廣東話書面語。
格式：
- 建議一
- 建議二
- 建議三`,
    }

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[field] }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(data.error || 'AI generation failed')

      const text = data.content?.find?.((part: { type?: string; text?: string }) => part.type === 'text')?.text
        || data.content?.[0]?.text
        || ''

      if (field === 'description') setDescription(text)
      if (field === 'why_trending') setWhyTrending(text)
      if (field === 'creator_tips') setCreatorTips(text)
    } catch {
      window.alert('AI 生成失敗，請重試')
    } finally {
      setGeneratingField(null)
    }
  }

  function removeAngle(index: number) {
    setDraft((current) => ({
      ...current,
      angles: current.angles.filter((_, angleIndex) => angleIndex !== index),
    }))
  }

  async function uploadTopicIcon(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      window.alert('請上傳圖片檔案')
      return
    }
    if (file.size > 300 * 1024) {
      window.alert('Icon 圖片請壓縮至 300KB 以下，建議 256×256 PNG/WebP 透明底。')
      return
    }

    try {
      const dataUrl = await readImageAsDataUrl(file)
      setDraft((current) => ({ ...current, icon: dataUrl }))
    } catch (uploadError) {
      window.alert(uploadError instanceof Error ? uploadError.message : '上傳失敗')
    }
  }

  async function uploadAngleIcon(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      window.alert('請上傳圖片檔案')
      return
    }
    if (file.size > 300 * 1024) {
      window.alert('角度 icon 圖片請壓縮至 300KB 以下，建議 128×128 PNG/WebP 透明底。')
      return
    }

    try {
      const dataUrl = await readImageAsDataUrl(file)
      setDraft((current) => ({
        ...current,
        angles: current.angles.map((item, itemIndex) => itemIndex === index ? { ...item, emoji: dataUrl } : item),
      }))
    } catch (uploadError) {
      window.alert(uploadError instanceof Error ? uploadError.message : '上傳失敗')
    }
  }

  function resetDetailFields() {
    setShowDetail(false)
    setDescription('')
    setWhyTrending('')
    setCreatorTips('')
    setRelatedLinksText('')
    setDeadlineAt('')
    setDeadlineTimezone('Asia/Hong_Kong')
    setNewsItems([])
  }

  function closeModal() {
    setShowModal(false)
    setEditingTrend(null)
    setDraft(emptyDraft)
    resetDetailFields()
  }

  if (!authChecked || !isAdmin) {
    return (
      <DashboardShell activeSection="predikt">
        <main style={{ color: '#888888', padding: '48px 28px' }}>檢查權限中...</main>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell activeSection="predikt">
      <PageHeader
        icon="💬"
        title="討論區中心"
        subtitle="管理 Predikt 熱話題目"
        actions={<button type="button" onClick={openCreateModal} style={primaryButtonStyle}>+ 新增話題</button>}
      />

      <main style={{ padding: '0 28px 32px' }}>
        <section style={cardStyle}>
          {loading && <EmptyState text="載入 Predikt 話題中..." />}
          {!loading && error && <EmptyState text={`載入失敗：${error}`} />}
          {!loading && !error && trends.length === 0 && <EmptyState text="暫時未有話題" />}

          {!loading && !error && trends.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', minWidth: '860px', width: '100%' }}>
                <thead>
                  <tr>
                    {['Icon', '話題', '分類', 'Heat Score', '截止時間', 'Angles', '狀態', '操作'].map((header) => (
                      <th key={header} style={tableHeadStyle}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trends.map((trend) => (
                    <tr key={trend.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <td style={tableCellStyle}><IconPreview value={trend.icon} size={28} /></td>
                      <td style={tableCellStyle}><strong style={{ color: '#ffffff', display: 'block', fontSize: '16px' }}>{trend.topic}</strong></td>
                      <td style={tableCellStyle}>{categoryOptions.find((category) => category.value === trend.category)?.label || '新聞'}</td>
                      <td style={tableCellStyle}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={trend.heat_score ?? 0}
                          onChange={(event) => patchTrendLocal(trend.id, { heat_score: clampScore(Number(event.target.value)) })}
                          onBlur={() => void saveHeatScore(trend)}
                          style={{ ...inputStyle, width: '88px' }}
                        />
                      </td>
                      <td style={tableCellStyle}>
                        {trend.deadline_at
                          ? `${new Date(trend.deadline_at).toLocaleString('zh-HK', { dateStyle: 'medium', timeStyle: 'short', timeZone: trend.deadline_timezone || 'Asia/Hong_Kong' })} · ${(trend.deadline_timezone || 'Asia/Hong_Kong').replace('_', ' ')}`
                          : '未設定'}
                      </td>
                      <td style={tableCellStyle}>{parseAngles(trend.angles).length} 個角度</td>
                      <td style={tableCellStyle}>
                        <button
                          type="button"
                          onClick={() => void toggleActive(trend)}
                          style={{ ...toggleButtonStyle, background: trend.is_active ? '#10b981' : '#4b5563' }}
                        >
                          {trend.is_active ? '公開' : '隱藏'}
                        </button>
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button type="button" onClick={() => openEditModal(trend)} style={ghostButtonStyle}>編輯</button>
                          <button type="button" onClick={() => void deleteTrend(trend)} style={dangerButtonStyle}>刪除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {showModal && (
        <div style={modalBackdropStyle} onMouseDown={closeModal}>
          <section style={modalStyle} onMouseDown={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <h2 style={{ color: '#ffffff', fontSize: '18px', margin: 0 }}>{editingTrend ? '編輯話題' : '新增話題'}</h2>
                <p style={{ color: '#888888', fontSize: '12px', margin: '4px 0 0' }}>設定 Predikt 熱話題目同討論角度。</p>
              </div>
              <button type="button" onClick={closeModal} style={closeButtonStyle}>×</button>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={labelStyle}>
                <span>話題 Icon</span>
                <div style={uploadRowStyle}>
                  <div style={iconPreviewBoxStyle}>
                    <IconPreview value={draft.icon} size={38} />
                  </div>
                  <label style={uploadButtonStyle}>
                    上傳圖片
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/*" onChange={(event) => void uploadTopicIcon(event)} style={{ display: 'none' }} />
                  </label>
                  <button type="button" onClick={() => setDraft((current) => ({ ...current, icon: '💬' }))} style={ghostButtonStyle}>清除</button>
                </div>
                <small style={hintStyle}>建議 256×256 PNG/WebP，透明底最佳，檔案小於 300KB。會同步顯示於 SOON-LOG mobile。</small>
              </div>
              <label style={labelStyle}>話題名稱<input value={draft.topic} placeholder="2026 世界盃" onChange={(event) => setDraft((current) => ({ ...current, topic: event.target.value }))} style={inputStyle} /></label>
              <label style={labelStyle}>
                分類
                <select
                  value={draft.category}
                  onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                  style={inputStyle}
                >
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                搜尋關鍵字
                <input
                  value={draft.keywords}
                  placeholder="例：2026世界盃, FIFA, 香港球迷"
                  onChange={(event) => setDraft((current) => ({ ...current, keywords: event.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>Heat Score<input type="number" min={0} max={100} value={draft.heat_score} onChange={(event) => setDraft((current) => ({ ...current, heat_score: clampScore(Number(event.target.value)) }))} style={inputStyle} /></label>
              <label style={labelStyle}>
                截止時間
                <input
                  type="datetime-local"
                  value={deadlineAt}
                  onChange={(event) => setDeadlineAt(event.target.value)}
                  style={inputStyle}
                />
                <small style={hintStyle}>例如 2026-05-31 23:59，會喺 SOON-LOG 討論區投票卡顯示。</small>
              </label>
              <label style={labelStyle}>
                截止時區
                <select
                  value={deadlineTimezone}
                  onChange={(event) => setDeadlineTimezone(event.target.value)}
                  style={inputStyle}
                >
                  {timezoneOptions.map((timezone) => (
                    <option key={timezone.value} value={timezone.value}>{timezone.label}</option>
                  ))}
                </select>
                <small style={hintStyle}>歐聯、世界盃等跨地區題目請揀開波當地時區，例如巴黎用 Europe/Paris。</small>
              </label>
              <label style={{ ...labelStyle, alignItems: 'center', display: 'flex', flexDirection: 'row', gap: '10px' }}><input type="checkbox" checked={draft.is_active} onChange={(event) => setDraft((current) => ({ ...current, is_active: event.target.checked }))} />公開顯示</label>

              <div>
                <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#f5f5f5', fontSize: '13px', fontWeight: 600 }}>討論角度</span>
                  <button type="button" onClick={() => setDraft((current) => ({ ...current, angles: [...current.angles, { emoji: '💬', name: '', percentage: 0 }] }))} style={ghostButtonStyle}>+ 新增角度</button>
                </div>
                {angleTotal !== 100 && <p style={{ color: '#f59e0b', fontSize: '12px', margin: '0 0 8px' }}>目前百分比總和是 {angleTotal}%，儲存時會自動 normalize 到 100%。</p>}
                <div style={{ display: 'grid', gap: '8px' }}>
                  {draft.angles.map((angle, index) => (
                    <div key={index} style={{ display: 'grid', gap: '8px', gridTemplateColumns: '86px 1fr 92px 42px' }}>
                      <label style={angleUploadStyle} title="建議 128×128 PNG/WebP，透明底最佳，小於 300KB">
                        <IconPreview value={angle.emoji} size={28} />
                        <span>上傳</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/*" onChange={(event) => void uploadAngleIcon(index, event)} style={{ display: 'none' }} />
                      </label>
                      <input
                        value={angle.name}
                        placeholder="角度名稱"
                        onChange={(event) => {
                          const nextValue = event.target.value
                          setDraft((current) => ({
                            ...current,
                            angles: current.angles.map((item, itemIndex) => itemIndex === index ? { ...item, name: nextValue } : item),
                          }))
                        }}
                        style={inputStyle}
                      />
                      <input
                        type="number"
                        value={angle.percentage}
                        onChange={(event) => {
                          const nextValue = parseInt(event.target.value, 10) || 0
                          setDraft((current) => ({
                            ...current,
                            angles: current.angles.map((item, itemIndex) => itemIndex === index ? { ...item, percentage: nextValue } : item),
                          }))
                        }}
                        style={inputStyle}
                      />
                      <button type="button" onClick={() => removeAngle(index)} style={dangerButtonStyle}>×</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowDetail((current) => !current)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#7c3aed',
                    cursor: 'pointer',
                    fontSize: 14,
                    marginBottom: 8,
                    padding: 0,
                  }}
                >
                  {showDetail ? '▼ 收起詳細內容' : '▶ 加入詳細內容（選填）'}
                </button>

                {showDetail && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <DetailTextarea
                      label="話題背景"
                      value={description}
                      onChange={setDescription}
                      placeholder="介紹呢個話題嘅背景同來龍去脈..."
                      aiField="description"
                      generatingField={generatingField}
                      disableGenerate={!draft.topic.trim()}
                      onGenerate={generateWithAI}
                    />
                    <DetailTextarea
                      label="點解而家咁熱？"
                      value={whyTrending}
                      onChange={setWhyTrending}
                      placeholder="解釋點解呢個話題最近特別受關注..."
                      aiField="why_trending"
                      generatingField={generatingField}
                      disableGenerate={!draft.topic.trim()}
                      onGenerate={generateWithAI}
                    />
                    <DetailTextarea
                      label="Creator 可以點拍？"
                      value={creatorTips}
                      onChange={setCreatorTips}
                      placeholder="建議 creator 可以從咩角度入手拍攝呢個題材..."
                      aiField="creator_tips"
                      generatingField={generatingField}
                      disableGenerate={!draft.topic.trim()}
                      onGenerate={generateWithAI}
                    />
                    <DetailTextarea
                      label="相關連結（每行一個）"
                      value={relatedLinksText}
                      onChange={setRelatedLinksText}
                      placeholder="https://example.com"
                    />
                    <div>
                      <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <label style={{ color: '#aaa', fontSize: 13 }}>相關新聞</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => setNewsItems((current) => [...current, { title: '', source: '', url: '', published_at: null }])}
                            style={ghostButtonStyle}
                          >
                            + 新增新聞
                          </button>
                          <button
                            type="button"
                            onClick={() => void fetchNews()}
                            disabled={fetchingNews}
                            style={primaryButtonStyle}
                          >
                            {fetchingNews ? '抓取中...' : '✨ 抓取最新新聞'}
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {newsItems.length === 0 && <div style={newsEmptyStyle}>暫時未有新聞。可用關鍵字自動抓取，或手動新增。</div>}
                        {newsItems.map((item, index) => (
                          <div key={`${item.title}-${index}`} style={newsItemStyle}>
                            <input
                              value={item.title}
                              placeholder="新聞標題"
                              onChange={(event) => patchNewsItem(index, { title: event.target.value })}
                              style={inputStyle}
                            />
                            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1.6fr 170px 42px' }}>
                              <input
                                value={item.source || ''}
                                placeholder="來源"
                                onChange={(event) => patchNewsItem(index, { source: event.target.value })}
                                style={inputStyle}
                              />
                              <input
                                value={item.url || ''}
                                placeholder="https://..."
                                onChange={(event) => patchNewsItem(index, { url: event.target.value })}
                                style={inputStyle}
                              />
                              <input
                                value={item.published_at || ''}
                                placeholder="published_at ISO"
                                onChange={(event) => patchNewsItem(index, { published_at: event.target.value })}
                                style={inputStyle}
                              />
                              <button
                                type="button"
                                onClick={() => setNewsItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                style={dangerButtonStyle}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button type="button" onClick={() => void saveTrend()} disabled={saving} style={primaryButtonStyle}>{saving ? '儲存中...' : '儲存'}</button>
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ border: '1px dashed rgba(255,255,255,0.10)', borderRadius: '12px', color: '#888888', fontSize: '13px', padding: '30px', textAlign: 'center' }}>
      {text}
    </div>
  )
}

function DetailTextarea({
  label,
  value,
  onChange,
  placeholder,
  aiField,
  generatingField,
  disableGenerate,
  onGenerate,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  aiField?: DetailField
  generatingField?: DetailField | null
  disableGenerate?: boolean
  onGenerate?: (field: DetailField) => void
}) {
  const isGenerating = generatingField === aiField

  return (
    <div>
      <div style={{
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <label style={{ color: '#aaa', fontSize: 13 }}>{label}</label>
        {aiField && onGenerate && (
          <button
            type="button"
            onClick={() => onGenerate(aiField)}
            disabled={isGenerating || disableGenerate}
            title={disableGenerate ? '請先填寫話題名稱' : ''}
            style={{
              alignItems: 'center',
              backgroundColor: isGenerating ? '#333' : '#2d1b69',
              border: '1px solid #4c1d95',
              borderRadius: 6,
              color: isGenerating ? '#888' : '#a78bfa',
              cursor: isGenerating || disableGenerate ? 'not-allowed' : 'pointer',
              display: 'flex',
              fontSize: 12,
              gap: 4,
              opacity: disableGenerate ? 0.55 : 1,
              padding: '3px 10px',
            }}
          >
            {isGenerating ? '⏳ 生成中...' : '✨ AI 生成'}
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 8,
          color: 'white',
          fontFamily: 'inherit',
          fontSize: 14,
          padding: '8px 12px',
          resize: 'vertical',
          width: '100%',
        }}
      />
    </div>
  )
}

const cardStyle = { background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '18px' }
const tableHeadStyle = { color: '#888888', fontSize: '12px', fontWeight: 600, padding: '10px 12px', textAlign: 'left' as const }
const tableCellStyle = { color: '#d1d5db', fontSize: '13px', padding: '12px', verticalAlign: 'middle' as const }
const inputStyle = { background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#ffffff', fontSize: '13px', outline: 'none', padding: '9px 10px', width: '100%' }
const labelStyle = { color: '#f5f5f5', display: 'grid', fontSize: '13px', gap: '6px' }
const hintStyle = { color: '#888888', fontSize: '12px', lineHeight: 1.5 }
const newsEmptyStyle = { border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '10px', color: '#888888', fontSize: '12px', padding: '14px', textAlign: 'center' as const }
const newsItemStyle = { background: '#101010', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '10px', display: 'grid', gap: '8px', padding: '10px' }
const uploadRowStyle = { alignItems: 'center', display: 'flex', gap: '10px' }
const iconPreviewBoxStyle = { alignItems: 'center', background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', display: 'flex', height: '56px', justifyContent: 'center', width: '56px' }
const uploadButtonStyle = { background: '#1f1538', border: '1px solid #4c1d95', borderRadius: '8px', color: '#c4b5fd', cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: '9px 12px' }
const angleUploadStyle = { alignItems: 'center', background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#a78bfa', cursor: 'pointer', display: 'flex', fontSize: '11px', gap: '7px', justifyContent: 'center', minHeight: '42px', padding: '7px 8px' }
const primaryButtonStyle = { background: '#7c3aed', border: 'none', borderRadius: '9px', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: '10px 16px' }
const ghostButtonStyle = { background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#a78bfa', cursor: 'pointer', fontSize: '12px', padding: '8px 10px' }
const dangerButtonStyle = { background: 'transparent', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '12px', padding: '8px 10px' }
const toggleButtonStyle = { border: 'none', borderRadius: '999px', color: '#ffffff', cursor: 'pointer', fontSize: '12px', fontWeight: 600, minWidth: '58px', padding: '7px 10px' }
const modalBackdropStyle = { alignItems: 'center', background: 'rgba(0,0,0,0.65)', display: 'flex', inset: 0, justifyContent: 'center', padding: '24px', position: 'fixed' as const, zIndex: 80 }
const modalStyle = { background: '#141414', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '16px', boxShadow: '0 24px 80px rgba(0,0,0,0.45)', maxHeight: '90vh', maxWidth: '720px', overflowY: 'auto' as const, padding: '22px', width: '100%' }
const closeButtonStyle = { background: 'transparent', border: 'none', color: '#888888', cursor: 'pointer', fontSize: '24px', lineHeight: 1 }
