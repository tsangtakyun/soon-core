'use client'

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { CoreDoc } from '@/lib/types'

type Lang = 'zh' | 'en'
type Source = 'manual' | 'youtube' | 'meta'
type Platform = 'youtube' | 'instagram'

type MetricValue = {
  value: string
  source: Source
}

type AudienceRow = {
  id: string
  label: string
  percent: string
}

type Screenshot = {
  id: string
  src: string
  caption: string
}

type BrandMention = {
  id: string
  videoTitle: string
  position: string
  format: string
  notes: string
}

type CampaignVideo = {
  id: string
  platform: Platform
  url: string
  title: string
  thumbnail: string
  publishDate: string
  duration: string
  manual: boolean
  notes: string
  metrics: {
    views: MetricValue
    likes: MetricValue
    comments: MetricValue
    shares: MetricValue
    saves: MetricValue
    profileActivity: MetricValue
    retentionRate: MetricValue
    skipRate: MetricValue
    avgWatchTime: MetricValue
    totalWatchTime: MetricValue
  }
  audience: {
    gender: AudienceRow[]
    location: AudienceRow[]
    age: AudienceRow[]
    traffic: AudienceRow[]
  }
  screenshots: Screenshot[]
}

type CampaignReportContent = {
  language: Lang
  title: string
  campaignName: string
  startDate: string
  endDate: string
  preparedBy: string
  preparedFor: string
  clientLogo: string
  executiveSummary: string
  performanceAnalysis: string
  recommendations: string
  videos: CampaignVideo[]
  overallAudience: {
    gender: AudienceRow[]
    location: AudienceRow[]
    age: AudienceRow[]
  }
  brandMentions: BrandMention[]
  createdAt: string
  updatedAt: string
}

type SettingsSnapshot = {
  logo_base64: string
  company_name: string
  display_name: string
  youtube_client_id: string
  youtube_client_secret: string
  meta_app_id: string
  meta_app_secret: string
}

type Props = {
  doc: CoreDoc
  onBack: () => void
  onSaved: (doc: CoreDoc) => void
}

const langStorageKey = 'soon-campaign-report-lang'

const copy = {
  zh: {
    back: '← 文件中心',
    chinese: '中文',
    english: 'English',
    pdf: '匯出 PDF',
    word: '匯出 Word',
    save: 'Save',
    saved: '已儲存',
    ai: '✨ AI 生成摘要',
    aiLoading: 'AI 生成中...',
    title: '活動成效報告',
    campaignName: '活動名稱',
    dateRange: '日期範圍',
    preparedBy: '準備者',
    preparedFor: '準備予',
    uploadClientLogo: '上傳客戶 Logo',
    executiveSummary: '執行摘要',
    totalViews: '總觀看次數',
    totalEngagements: '總互動次數',
    avgRetention: '平均留存率',
    totalVideos: '影片數量',
    videos: '影片表現',
    addVideo: '+ 新增影片',
    fetchApi: '從 API 獲取',
    manual: '手動填入',
    videoUrl: '影片 URL',
    platform: '平台',
    publishDate: '發布日期',
    duration: '時長',
    deepMetrics: '深度數據',
    rawScreenshots: '原始截圖',
    notes: '備注',
    overallAudience: '整體觀眾洞察',
    brandMentions: '品牌提及分析',
    summaryRecommendations: '總結及建議',
    performanceAnalysis: '整體表現分析',
    recommendations: '下次活動建議',
    add: '+ 新增',
    sourceName: '來源',
    percent: '%',
    gender: '性別',
    location: '地區',
    age: '年齡',
    traffic: '流量來源',
    videoTitle: '影片標題',
    position: '出現位置',
    format: '形式',
    connectYoutube: '連接 YouTube',
    connectMeta: '連接 Meta',
    youtubeConnected: 'YouTube ●',
    metaConnected: 'Meta ●',
    apiNotReady: '請先喺 Settings / Vercel 設定相關 API key/token。',
  },
  en: {
    back: '← Docs Center',
    chinese: '中文',
    english: 'English',
    pdf: 'Export PDF',
    word: 'Export Word',
    save: 'Save',
    saved: 'Saved',
    ai: '✨ AI Summary',
    aiLoading: 'Generating...',
    title: 'Campaign Report',
    campaignName: 'Campaign name',
    dateRange: 'Date range',
    preparedBy: 'Prepared by',
    preparedFor: 'Prepared for',
    uploadClientLogo: 'Upload client logo',
    executiveSummary: 'Executive Summary',
    totalViews: 'Total Views',
    totalEngagements: 'Total Engagements',
    avgRetention: 'Avg Retention Rate',
    totalVideos: 'Total Videos',
    videos: 'Video Performance',
    addVideo: '+ Add Video',
    fetchApi: 'Fetch from API',
    manual: 'Manual input',
    videoUrl: 'Video URL',
    platform: 'Platform',
    publishDate: 'Publish date',
    duration: 'Duration',
    deepMetrics: 'Deep Metrics',
    rawScreenshots: 'Raw Screenshots',
    notes: 'Notes',
    overallAudience: 'Overall Audience Insights',
    brandMentions: 'Brand Mention Analysis',
    summaryRecommendations: 'Summary & Recommendations',
    performanceAnalysis: 'Performance Analysis',
    recommendations: 'Recommendations for Next Campaign',
    add: '+ Add',
    sourceName: 'Source',
    percent: '%',
    gender: 'Gender',
    location: 'Location',
    age: 'Age',
    traffic: 'Traffic',
    videoTitle: 'Video title',
    position: 'Position',
    format: 'Format',
    connectYoutube: 'Connect YouTube',
    connectMeta: 'Connect Meta',
    youtubeConnected: 'YouTube ●',
    metaConnected: 'Meta ●',
    apiNotReady: 'Please configure API keys/tokens in Settings and Vercel first.',
  },
} as const

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

function emptyMetric(source: Source = 'manual'): MetricValue {
  return { value: '', source }
}

function createAudienceRows(labels: string[] = []) {
  return labels.map((label) => ({ id: makeId(), label, percent: '' }))
}

function createEmptyVideo(platform: Platform = 'youtube'): CampaignVideo {
  return {
    id: makeId(),
    platform,
    url: '',
    title: '',
    thumbnail: '',
    publishDate: '',
    duration: '',
    manual: true,
    notes: '',
    metrics: {
      views: emptyMetric(),
      likes: emptyMetric(),
      comments: emptyMetric(),
      shares: emptyMetric(),
      saves: emptyMetric(),
      profileActivity: emptyMetric(),
      retentionRate: emptyMetric(),
      skipRate: emptyMetric(),
      avgWatchTime: emptyMetric(),
      totalWatchTime: emptyMetric(),
    },
    audience: {
      gender: createAudienceRows(['男性', '女性']),
      location: createAudienceRows(['香港', '新加坡']),
      age: createAudienceRows(['18-24', '25-34']),
      traffic: createAudienceRows(['Browse', 'Search']),
    },
    screenshots: [],
  }
}

export function createEmptyCampaignReport(language: Lang = 'zh'): CampaignReportContent {
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  return {
    language,
    title: language === 'zh' ? '活動成效報告' : 'Campaign Report',
    campaignName: '',
    startDate: today,
    endDate: today,
    preparedBy: 'Tommy',
    preparedFor: '',
    clientLogo: '',
    executiveSummary: '',
    performanceAnalysis: '',
    recommendations: '',
    videos: [createEmptyVideo()],
    overallAudience: {
      gender: createAudienceRows(['男性', '女性']),
      location: createAudienceRows(['香港', '新加坡']),
      age: createAudienceRows(['18-24', '25-34']),
    },
    brandMentions: [{ id: makeId(), videoTitle: '', position: '', format: '', notes: '' }],
    createdAt: now,
    updatedAt: now,
  }
}

function parseCampaignReport(content: string | null, fallbackLanguage: Lang): CampaignReportContent {
  if (!content) return createEmptyCampaignReport(fallbackLanguage)
  try {
    const parsed = JSON.parse(content) as Partial<CampaignReportContent>
    const fallback = createEmptyCampaignReport(fallbackLanguage)
    return {
      ...fallback,
      ...parsed,
      language: parsed.language === 'en' || parsed.language === 'zh' ? parsed.language : fallbackLanguage,
      videos: parsed.videos?.length ? parsed.videos : fallback.videos,
      overallAudience: parsed.overallAudience ?? fallback.overallAudience,
      brandMentions: parsed.brandMentions?.length ? parsed.brandMentions : fallback.brandMentions,
    }
  } catch {
    return createEmptyCampaignReport(fallbackLanguage)
  }
}

function getStoredLanguage(): Lang {
  if (typeof window === 'undefined') return 'zh'
  return window.localStorage.getItem(langStorageKey) === 'en' ? 'en' : 'zh'
}

function toNumber(value: string) {
  const numeric = Number(String(value).replace(/,/g, '').replace('%', ''))
  return Number.isFinite(numeric) ? numeric : 0
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)
}

function sourceLabel(source: Source, language: Lang) {
  if (source === 'youtube') return 'via YouTube Analytics'
  if (source === 'meta') return 'via Meta Insights'
  return language === 'zh' ? '手動填入' : 'Manual'
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function CampaignReportEditor({ doc, onBack, onSaved }: Props) {
  const [content, setContent] = useState<CampaignReportContent>(() => parseCampaignReport(doc.content, getStoredLanguage()))
  const [settings, setSettings] = useState<SettingsSnapshot>({
    logo_base64: '',
    company_name: 'SOON Studio',
    display_name: 'Tommy',
    youtube_client_id: '',
    youtube_client_secret: '',
    meta_app_id: '',
    meta_app_secret: '',
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [fetchingVideoId, setFetchingVideoId] = useState<string | null>(null)
  const c = copy[content.language]

  useEffect(() => {
    void loadSettings()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => void save(false), 30000)
    return () => window.clearInterval(timer)
  })

  async function loadSettings() {
    const { data } = await supabase.from('settings').select('*').eq('user_id', 'tommy').maybeSingle()
    if (!data) return
    setSettings({
      logo_base64: String(data.logo_base64 ?? ''),
      company_name: String(data.company_name ?? 'SOON Studio'),
      display_name: String(data.display_name ?? 'Tommy'),
      youtube_client_id: String(data.youtube_client_id ?? ''),
      youtube_client_secret: String(data.youtube_client_secret ?? ''),
      meta_app_id: String(data.meta_app_id ?? ''),
      meta_app_secret: String(data.meta_app_secret ?? ''),
    })
    setContent((current) => ({ ...current, preparedBy: current.preparedBy || String(data.display_name ?? 'Tommy') }))
  }

  function update(patch: Partial<CampaignReportContent>) {
    setSaved(false)
    setContent((current) => ({ ...current, ...patch }))
  }

  function setLanguage(language: Lang) {
    window.localStorage.setItem(langStorageKey, language)
    update({ language, title: content.title || copy[language].title })
  }

  async function save(showIndicator = true) {
    setSaving(true)
    const next = { ...content, updatedAt: new Date().toISOString() }
    const { data, error } = await supabase
      .from('docs')
      .update({ title: next.title || c.title, content: JSON.stringify(next) })
      .eq('id', doc.id)
      .select()
      .single()
    setSaving(false)
    if (error) {
      if (showIndicator) window.alert(error.message)
      return
    }
    setContent(next)
    setSaved(true)
    onSaved(data as CoreDoc)
  }

  const totals = useMemo(() => {
    const views = content.videos.reduce((sum, video) => sum + toNumber(video.metrics.views.value), 0)
    const engagements = content.videos.reduce(
      (sum, video) =>
        sum +
        toNumber(video.metrics.likes.value) +
        toNumber(video.metrics.comments.value) +
        toNumber(video.metrics.shares.value) +
        toNumber(video.metrics.saves.value) +
        toNumber(video.metrics.profileActivity.value),
      0,
    )
    const retentionValues = content.videos.map((video) => toNumber(video.metrics.retentionRate.value)).filter(Boolean)
    const avgRetention = retentionValues.length
      ? retentionValues.reduce((sum, value) => sum + value, 0) / retentionValues.length
      : 0
    return { views, engagements, avgRetention, videoCount: content.videos.length }
  }, [content.videos])

  function updateVideo(videoId: string, patch: Partial<CampaignVideo>) {
    update({ videos: content.videos.map((video) => (video.id === videoId ? { ...video, ...patch } : video)) })
  }

  function updateVideoMetric(videoId: string, key: keyof CampaignVideo['metrics'], value: string, source?: Source) {
    update({
      videos: content.videos.map((video) =>
        video.id === videoId
          ? { ...video, metrics: { ...video.metrics, [key]: { value, source: source ?? video.metrics[key].source } } }
          : video,
      ),
    })
  }

  function updateAudience(
    videoId: string,
    group: keyof CampaignVideo['audience'],
    rowId: string,
    patch: Partial<AudienceRow>,
  ) {
    update({
      videos: content.videos.map((video) =>
        video.id === videoId
          ? {
              ...video,
              audience: {
                ...video.audience,
                [group]: video.audience[group].map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
              },
            }
          : video,
      ),
    })
  }

  function addAudienceRow(videoId: string, group: keyof CampaignVideo['audience']) {
    update({
      videos: content.videos.map((video) =>
        video.id === videoId
          ? {
              ...video,
              audience: { ...video.audience, [group]: [...video.audience[group], { id: makeId(), label: '', percent: '' }] },
            }
          : video,
      ),
    })
  }

  function updateOverallAudience(group: keyof CampaignReportContent['overallAudience'], rowId: string, patch: Partial<AudienceRow>) {
    update({
      overallAudience: {
        ...content.overallAudience,
        [group]: content.overallAudience[group].map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
      },
    })
  }

  async function uploadClientLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    update({ clientLogo: await fileToDataUrl(file) })
  }

  async function uploadVideoImage(videoId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    updateVideo(videoId, { thumbnail: await fileToDataUrl(file) })
  }

  async function uploadScreenshots(videoId: string, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    const nextScreenshots = await Promise.all(
      files.map(async (file) => ({
        id: makeId(),
        src: await fileToDataUrl(file),
        caption: content.language === 'zh' ? 'Instagram Insights 截圖' : 'Insights screenshot',
      })),
    )
    update({
      videos: content.videos.map((video) =>
        video.id === videoId ? { ...video, screenshots: [...video.screenshots, ...nextScreenshots] } : video,
      ),
    })
  }

  async function fetchVideoData(video: CampaignVideo) {
    if (!video.url.trim()) {
      window.alert('Please enter a video URL first.')
      return
    }
    setFetchingVideoId(video.id)
    try {
      const endpoint = video.platform === 'youtube' ? '/api/youtube-video' : '/api/meta-video'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: video.url }),
      })
      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error || 'Fetch failed')
      const source: Source = video.platform === 'youtube' ? 'youtube' : 'meta'
      const nextMetrics = {
        ...video.metrics,
        views: { value: String(data.views ?? ''), source },
        likes: { value: String(data.likes ?? ''), source },
        comments: { value: String(data.comments ?? ''), source },
        shares: { value: String(data.shares ?? ''), source },
        saves: { value: String(data.saves ?? ''), source },
        profileActivity: { value: String(data.profileActivity ?? ''), source },
        avgWatchTime: { value: String(data.avgWatchTime ?? ''), source },
        totalWatchTime: { value: String(data.totalWatchTime ?? ''), source },
      }
      updateVideo(video.id, {
        title: data.title ?? video.title,
        thumbnail: data.thumbnail ?? video.thumbnail,
        publishDate: data.publishDate ?? video.publishDate,
        duration: data.duration ?? video.duration,
        metrics: nextMetrics,
        manual: false,
      })
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Fetch failed')
    } finally {
      setFetchingVideoId(null)
    }
  }

  async function runAiSummary() {
    setAiLoading(true)
    try {
      const response = await fetch('/api/campaign-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign: content, totals }),
      })
      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error || 'AI summary failed')
      update({
        executiveSummary: data.executive_summary ?? content.executiveSummary,
        performanceAnalysis: data.performance_analysis ?? content.performanceAnalysis,
        recommendations: data.recommendations ?? content.recommendations,
      })
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'AI summary failed')
    } finally {
      setAiLoading(false)
    }
  }

  function exportWord() {
    const html = buildWordHtml(content, totals, c)
    const blob = new Blob([html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${content.campaignName || 'campaign-report'}.doc`
    link.click()
    URL.revokeObjectURL(url)
  }

  function connectionClick(kind: 'youtube' | 'meta') {
    const connected =
      kind === 'youtube'
        ? settings.youtube_client_id && settings.youtube_client_secret
        : settings.meta_app_id && settings.meta_app_secret
    if (!connected) window.alert(c.apiNotReady)
  }

  return (
    <section className="doc-editor-shell campaign-report-editor">
      <div className="doc-toolbar soon-no-print">
        <button type="button" onClick={onBack}>
          {c.back}
        </button>
        <div className="doc-language-toggle">
          {(['zh', 'en'] as Lang[]).map((language) => (
            <button
              key={language}
              className={content.language === language ? 'active' : ''}
              type="button"
              onClick={() => setLanguage(language)}
            >
              {language === 'zh' ? c.chinese : c.english}
            </button>
          ))}
        </div>
        <div className="toolbar-spacer" />
        <button className="doc-secondary-button" type="button" onClick={() => connectionClick('youtube')}>
          {settings.youtube_client_id && settings.youtube_client_secret ? c.youtubeConnected : `🔗 ${c.connectYoutube}`}
        </button>
        <button className="doc-secondary-button" type="button" onClick={() => connectionClick('meta')}>
          {settings.meta_app_id && settings.meta_app_secret ? c.metaConnected : `🔗 ${c.connectMeta}`}
        </button>
        <button className="doc-save-button" type="button" disabled={aiLoading} onClick={() => void runAiSummary()}>
          {aiLoading ? c.aiLoading : c.ai}
        </button>
        <button className="doc-export-dark" type="button" onClick={() => window.print()}>
          {c.pdf}
        </button>
        <button className="doc-export-blue" type="button" onClick={exportWord}>
          {c.word}
        </button>
        <button className="doc-save-button" type="button" onClick={() => void save()}>
          {saving ? 'Saving...' : c.save}
        </button>
        {saved && <span className="doc-saved-indicator">{c.saved}</span>}
      </div>

      <article className="doc-paper campaign-document soon-print-doc">
        <header className="campaign-cover">
          <div>
            {settings.logo_base64 ? <img className="campaign-company-logo" src={settings.logo_base64} alt="Company logo" /> : <strong>{settings.company_name}</strong>}
            <input className="campaign-title-input" value={content.title} onChange={(event) => update({ title: event.target.value })} />
            <label>
              {c.campaignName}
              <input value={content.campaignName} onChange={(event) => update({ campaignName: event.target.value })} />
            </label>
            <label>
              {c.dateRange}
              <div className="campaign-date-row">
                <input type="date" value={content.startDate} onChange={(event) => update({ startDate: event.target.value })} />
                <span>→</span>
                <input type="date" value={content.endDate} onChange={(event) => update({ endDate: event.target.value })} />
              </div>
            </label>
          </div>
          <div className="campaign-client-logo">
            {content.clientLogo ? <img src={content.clientLogo} alt="Client logo" /> : <span>{c.uploadClientLogo}</span>}
            <input type="file" accept="image/*" onChange={(event) => void uploadClientLogo(event)} />
            <label>
              {c.preparedBy}
              <input value={content.preparedBy} onChange={(event) => update({ preparedBy: event.target.value })} />
            </label>
            <label>
              {c.preparedFor}
              <input value={content.preparedFor} onChange={(event) => update({ preparedFor: event.target.value })} />
            </label>
          </div>
        </header>

        <CampaignSection title={c.executiveSummary}>
          <div className="campaign-metrics-grid">
            <MetricCard label={c.totalViews} value={formatNumber(totals.views)} source="manual" language={content.language} />
            <MetricCard label={c.totalEngagements} value={formatNumber(totals.engagements)} source="manual" language={content.language} />
            <MetricCard label={c.avgRetention} value={`${formatNumber(totals.avgRetention)}%`} source="manual" language={content.language} />
            <MetricCard label={c.totalVideos} value={String(totals.videoCount)} source="manual" language={content.language} />
          </div>
          <textarea
            className="campaign-summary-textarea"
            value={content.executiveSummary}
            placeholder={content.language === 'zh' ? '點擊「AI 生成摘要」自動生成執行摘要...' : 'Click AI Summary to generate an executive summary...'}
            onChange={(event) => update({ executiveSummary: event.target.value })}
          />
        </CampaignSection>

        <CampaignSection title={c.videos}>
          <button className="campaign-add-button soon-no-print" type="button" onClick={() => update({ videos: [...content.videos, createEmptyVideo()] })}>
            {c.addVideo}
          </button>
          <div className="campaign-video-list">
            {content.videos.map((video) => (
              <VideoBlock
                key={video.id}
                video={video}
                language={content.language}
                labels={c}
                fetching={fetchingVideoId === video.id}
                onFetch={() => void fetchVideoData(video)}
                onUpdate={(patch) => updateVideo(video.id, patch)}
                onMetric={(key, value, source) => updateVideoMetric(video.id, key, value, source)}
                onImageUpload={(event) => void uploadVideoImage(video.id, event)}
                onScreenshots={(event) => void uploadScreenshots(video.id, event)}
                onAudience={(group, rowId, patch) => updateAudience(video.id, group, rowId, patch)}
                onAddAudience={(group) => addAudienceRow(video.id, group)}
                onDelete={() => update({ videos: content.videos.filter((item) => item.id !== video.id) })}
              />
            ))}
          </div>
        </CampaignSection>

        <CampaignSection title={c.overallAudience}>
          <div className="campaign-audience-overall">
            {(['gender', 'location', 'age'] as const).map((group) => (
              <AudiencePanel
                key={group}
                title={c[group]}
                rows={content.overallAudience[group]}
                onChange={(rowId, patch) => updateOverallAudience(group, rowId, patch)}
                onAdd={() =>
                  update({
                    overallAudience: {
                      ...content.overallAudience,
                      [group]: [...content.overallAudience[group], { id: makeId(), label: '', percent: '' }],
                    },
                  })
                }
              />
            ))}
          </div>
        </CampaignSection>

        <CampaignSection title={c.brandMentions}>
          <table className="campaign-table">
            <thead>
              <tr>
                <th>{c.videoTitle}</th>
                <th>{c.position}</th>
                <th>{c.format}</th>
                <th>{c.notes}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {content.brandMentions.map((mention) => (
                <tr key={mention.id}>
                  <td>
                    <select
                      value={mention.videoTitle}
                      onChange={(event) =>
                        update({
                          brandMentions: content.brandMentions.map((item) =>
                            item.id === mention.id ? { ...item, videoTitle: event.target.value } : item,
                          ),
                        })
                      }
                    >
                      <option value="" />
                      {content.videos.map((video) => (
                        <option key={video.id} value={video.title}>
                          {video.title || video.platform}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={mention.position}
                      onChange={(event) =>
                        update({
                          brandMentions: content.brandMentions.map((item) =>
                            item.id === mention.id ? { ...item, position: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={mention.format}
                      onChange={(event) =>
                        update({
                          brandMentions: content.brandMentions.map((item) =>
                            item.id === mention.id ? { ...item, format: event.target.value } : item,
                          ),
                        })
                      }
                    >
                      <option value="" />
                      <option value="口頭提及">口頭提及</option>
                      <option value="畫面展示">畫面展示</option>
                      <option value="字幕">字幕</option>
                      <option value="產品使用">產品使用</option>
                    </select>
                  </td>
                  <td>
                    <input
                      value={mention.notes}
                      onChange={(event) =>
                        update({
                          brandMentions: content.brandMentions.map((item) =>
                            item.id === mention.id ? { ...item, notes: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="danger-text-button soon-no-print"
                      type="button"
                      onClick={() => update({ brandMentions: content.brandMentions.filter((item) => item.id !== mention.id) })}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="campaign-add-button soon-no-print"
            type="button"
            onClick={() =>
              update({
                brandMentions: [...content.brandMentions, { id: makeId(), videoTitle: '', position: '', format: '', notes: '' }],
              })
            }
          >
            {c.add}
          </button>
        </CampaignSection>

        <CampaignSection title={c.summaryRecommendations}>
          <label>
            {c.performanceAnalysis}
            <textarea value={content.performanceAnalysis} onChange={(event) => update({ performanceAnalysis: event.target.value })} />
          </label>
          <label>
            {c.recommendations}
            <textarea value={content.recommendations} onChange={(event) => update({ recommendations: event.target.value })} />
          </label>
        </CampaignSection>
      </article>
    </section>
  )
}

function CampaignSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="campaign-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function MetricCard({ label, value, source, language }: { label: string; value: string; source: Source; language: Lang }) {
  return (
    <div className="campaign-metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
      <SourceBadge source={source} language={language} />
    </div>
  )
}

function SourceBadge({ source, language }: { source: Source; language: Lang }) {
  return <span className={`source-badge ${source}`}>{sourceLabel(source, language)}</span>
}

function VideoBlock({
  video,
  language,
  labels,
  fetching,
  onFetch,
  onUpdate,
  onMetric,
  onImageUpload,
  onScreenshots,
  onAudience,
  onAddAudience,
  onDelete,
}: {
  video: CampaignVideo
  language: Lang
  labels: (typeof copy)[Lang]
  fetching: boolean
  onFetch: () => void
  onUpdate: (patch: Partial<CampaignVideo>) => void
  onMetric: (key: keyof CampaignVideo['metrics'], value: string, source?: Source) => void
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onScreenshots: (event: ChangeEvent<HTMLInputElement>) => void
  onAudience: (group: keyof CampaignVideo['audience'], rowId: string, patch: Partial<AudienceRow>) => void
  onAddAudience: (group: keyof CampaignVideo['audience']) => void
  onDelete: () => void
}) {
  const coreMetrics =
    video.platform === 'youtube'
      ? (['views', 'likes', 'comments', 'shares'] as const)
      : (['views', 'likes', 'comments', 'saves', 'shares', 'profileActivity'] as const)

  return (
    <article className="campaign-video-block">
      <div className="campaign-video-header">
        <span className={`platform-badge ${video.platform}`}>{video.platform === 'youtube' ? 'YouTube' : 'Instagram'}</span>
        <select value={video.platform} onChange={(event) => onUpdate({ platform: event.target.value as Platform })}>
          <option value="youtube">YouTube</option>
          <option value="instagram">Instagram</option>
        </select>
        <input value={video.url} placeholder={labels.videoUrl} onChange={(event) => onUpdate({ url: event.target.value })} />
        <button className="campaign-fetch-button soon-no-print" type="button" disabled={fetching} onClick={onFetch}>
          {fetching ? 'Fetching...' : labels.fetchApi}
        </button>
        <label className="campaign-manual-toggle soon-no-print">
          <input type="checkbox" checked={video.manual} onChange={(event) => onUpdate({ manual: event.target.checked })} />
          {labels.manual}
        </label>
        <button className="danger-text-button soon-no-print" type="button" onClick={onDelete}>
          ×
        </button>
      </div>

      <div className="campaign-video-info">
        <div>
          <label className="campaign-thumbnail">
            {video.thumbnail ? <img src={video.thumbnail} alt="" /> : <span>Thumbnail</span>}
            <input type="file" accept="image/*" onChange={onImageUpload} />
          </label>
        </div>
        <div className="campaign-video-fields">
          <label>
            {labels.videoTitle}
            <input value={video.title} onChange={(event) => onUpdate({ title: event.target.value })} />
          </label>
          <label>
            {labels.publishDate}
            <input type="date" value={video.publishDate} onChange={(event) => onUpdate({ publishDate: event.target.value })} />
          </label>
          <label>
            {labels.duration}
            <input value={video.duration} onChange={(event) => onUpdate({ duration: event.target.value })} />
          </label>
        </div>
      </div>

      <div className="campaign-core-metrics">
        {coreMetrics.map((key) => (
          <MetricInput
            key={key}
            label={metricLabel(key, language)}
            metric={video.metrics[key]}
            language={language}
            onChange={(value) => onMetric(key, value)}
          />
        ))}
      </div>

      <details className="campaign-deep-metrics">
        <summary>{labels.deepMetrics}</summary>
        <div className="campaign-core-metrics">
          {(['retentionRate', 'skipRate', 'avgWatchTime', 'totalWatchTime'] as const).map((key) => (
            <MetricInput
              key={key}
              label={metricLabel(key, language)}
              metric={video.metrics[key]}
              language={language}
              onChange={(value) => onMetric(key, value)}
            />
          ))}
        </div>
        <div className="campaign-audience-tabs">
          {(['gender', 'location', 'age', 'traffic'] as const).map((group) => (
            <AudiencePanel
              key={group}
              title={labels[group]}
              rows={video.audience[group]}
              onChange={(rowId, patch) => onAudience(group, rowId, patch)}
              onAdd={() => onAddAudience(group)}
            />
          ))}
        </div>
      </details>

      <div className="campaign-screenshots">
        <label>
          {labels.rawScreenshots}
          <input className="soon-no-print" type="file" accept="image/*" multiple onChange={onScreenshots} />
        </label>
        <div className="campaign-screenshot-grid">
          {video.screenshots.map((screenshot) => (
            <figure key={screenshot.id}>
              <img src={screenshot.src} alt="" />
              <input
                value={screenshot.caption}
                onChange={(event) =>
                  onUpdate({
                    screenshots: video.screenshots.map((item) =>
                      item.id === screenshot.id ? { ...item, caption: event.target.value } : item,
                    ),
                  })
                }
              />
            </figure>
          ))}
        </div>
      </div>

      <label>
        {labels.notes}
        <textarea value={video.notes} onChange={(event) => onUpdate({ notes: event.target.value })} />
      </label>
    </article>
  )
}

function MetricInput({
  label,
  metric,
  language,
  onChange,
}: {
  label: string
  metric: MetricValue
  language: Lang
  onChange: (value: string) => void
}) {
  return (
    <label className="campaign-metric-input">
      <span>{label}</span>
      <input value={metric.value} onChange={(event) => onChange(event.target.value)} />
      <SourceBadge source={metric.source} language={language} />
    </label>
  )
}

function AudiencePanel({
  title,
  rows,
  onChange,
  onAdd,
}: {
  title: string
  rows: AudienceRow[]
  onChange: (rowId: string, patch: Partial<AudienceRow>) => void
  onAdd: () => void
}) {
  return (
    <div className="campaign-audience-panel">
      <h3>{title}</h3>
      {rows.map((row) => (
        <div key={row.id} className="campaign-audience-row">
          <input value={row.label} onChange={(event) => onChange(row.id, { label: event.target.value })} />
          <input value={row.percent} onChange={(event) => onChange(row.id, { percent: event.target.value })} />
          <div className="campaign-bar-track">
            <span style={{ width: `${Math.max(0, Math.min(100, toNumber(row.percent)))}%` }} />
          </div>
        </div>
      ))}
      <button className="campaign-add-button soon-no-print" type="button" onClick={onAdd}>
        + Add
      </button>
    </div>
  )
}

function metricLabel(key: keyof CampaignVideo['metrics'], language: Lang) {
  const zh: Record<keyof CampaignVideo['metrics'], string> = {
    views: '觀看次數',
    likes: '讚好次數',
    comments: '留言數',
    shares: '分享次數',
    saves: '儲存次數',
    profileActivity: '個人檔案活動',
    retentionRate: '留存率',
    skipRate: '略過率',
    avgWatchTime: '平均觀看時間',
    totalWatchTime: '觀看時間',
  }
  const en: Record<keyof CampaignVideo['metrics'], string> = {
    views: 'Views',
    likes: 'Likes',
    comments: 'Comments',
    shares: 'Shares',
    saves: 'Saves',
    profileActivity: 'Profile Activity',
    retentionRate: 'Retention Rate',
    skipRate: 'Skip Rate',
    avgWatchTime: 'Avg Watch Time',
    totalWatchTime: 'Total Watch Time',
  }
  return language === 'zh' ? zh[key] : en[key]
}

function buildWordHtml(content: CampaignReportContent, totals: ReturnType<typeof formatTotals>, labels: (typeof copy)[Lang]) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a}h1{font-size:30px}h2{font-size:18px;margin-top:28px}
table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border:1px solid #e5e5e5;padding:8px;font-size:12px}
.metric{display:inline-block;width:22%;margin-right:2%;padding:12px;border:1px solid #e5e5e5}
img{max-width:100%}</style></head><body>
<h1>${escapeHtml(content.title)}</h1>
<p>${escapeHtml(content.campaignName)} | ${escapeHtml(content.startDate)} → ${escapeHtml(content.endDate)}</p>
<h2>${labels.executiveSummary}</h2>
<div class="metric">${labels.totalViews}<br><strong>${formatNumber(totals.views)}</strong></div>
<div class="metric">${labels.totalEngagements}<br><strong>${formatNumber(totals.engagements)}</strong></div>
<div class="metric">${labels.avgRetention}<br><strong>${formatNumber(totals.avgRetention)}%</strong></div>
<div class="metric">${labels.totalVideos}<br><strong>${totals.videoCount}</strong></div>
<p>${escapeHtml(content.executiveSummary)}</p>
<h2>${labels.videos}</h2>
${content.videos
  .map(
    (video) => `<h3>${escapeHtml(video.title || video.platform)}</h3>
${video.thumbnail ? `<img src="${video.thumbnail}" />` : ''}
<table><tbody>
<tr><td>Views</td><td>${escapeHtml(video.metrics.views.value)}</td></tr>
<tr><td>Likes</td><td>${escapeHtml(video.metrics.likes.value)}</td></tr>
<tr><td>Comments</td><td>${escapeHtml(video.metrics.comments.value)}</td></tr>
<tr><td>Shares</td><td>${escapeHtml(video.metrics.shares.value)}</td></tr>
</tbody></table><p>${escapeHtml(video.notes)}</p>`,
  )
  .join('')}
<h2>${labels.performanceAnalysis}</h2><p>${escapeHtml(content.performanceAnalysis)}</p>
<h2>${labels.recommendations}</h2><p>${escapeHtml(content.recommendations)}</p>
</body></html>`
}

function formatTotals(content: CampaignReportContent) {
  const views = content.videos.reduce((sum, video) => sum + toNumber(video.metrics.views.value), 0)
  const engagements = content.videos.reduce(
    (sum, video) =>
      sum +
      toNumber(video.metrics.likes.value) +
      toNumber(video.metrics.comments.value) +
      toNumber(video.metrics.shares.value) +
      toNumber(video.metrics.saves.value) +
      toNumber(video.metrics.profileActivity.value),
    0,
  )
  const retentionValues = content.videos.map((video) => toNumber(video.metrics.retentionRate.value)).filter(Boolean)
  const avgRetention = retentionValues.length
    ? retentionValues.reduce((sum, value) => sum + value, 0) / retentionValues.length
    : 0
  return { views, engagements, avgRetention, videoCount: content.videos.length }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
