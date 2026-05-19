'use client'

import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from 'react'

import { useWorkspace } from '@/app/context/workspace-context'
import { AcceptanceOfEngagementEditor, createEmptyAcceptance } from '@/components/AcceptanceOfEngagementEditor'
import { BlankDocumentEditor } from '@/components/BlankDocumentEditor'
import { CampaignReportEditor, createEmptyCampaignReport } from '@/components/CampaignReportEditor'
import { DashboardShell } from '@/components/DashboardShell'
import { ConceptBoardEditor } from '@/components/ConceptBoardEditor'
import PageHeader from '@/components/PageHeader'
import { DocumentBrandMark } from '@/components/DocumentBrandMark'
import { IGScriptEditor } from '@/components/IGScriptEditor'
import { InvoiceEditor } from '@/components/InvoiceEditor'
import { createEmptyMeetingNotes, MeetingNotesEditor } from '@/components/MeetingNotesEditor'
import { QuotationEditor } from '@/components/QuotationEditor'
import { YouTubeScriptEditor } from '@/components/YouTubeScriptEditor'
import { conceptBoardLangStorageKey, createEmptyConceptBoard } from '@/lib/concept-board'
import { createEmptyIGScript, igScriptLangStorageKey } from '@/lib/ig-script'
import { createEmptyInvoice, defaultSettings, normaliseCurrency, type InvoiceSettings } from '@/lib/invoice'
import { createEmptyQuotation, defaultQuotationSettings, mergeQuotationSettings, type QuotationSettings } from '@/lib/quotation'
import { supabase } from '@/lib/supabase'
import type { CoreDoc, Workspace } from '@/lib/types'
import { createEmptyYouTubeScript, youtubeScriptLangStorageKey } from '@/lib/youtube-script'

type BriefLang = 'zh' | 'en'
type BriefStatus = 'Planning' | 'In Progress' | 'On Hold' | 'Done'

const briefLangStorageKey = 'soon-brief-lang'

const templates = [
  {
    type: 'project_brief',
    icon: '📋',
    title: 'Project Brief',
    altTitle: '項目簡報',
    accent: '#7c3aed',
    preview: ['客戶名稱 _____', '項目類型 _____', '預算範圍 _____', '拍攝日期 _____'],
  },
  {
    type: 'invoice',
    icon: '🧾',
    title: 'Invoice',
    altTitle: '發票',
    accent: '#0ea5e9',
    preview: ['發票號碼 INV-001', '客戶 _____', '服務項目 _____', '總金額 HK$_____'],
  },
  {
    type: 'quotation',
    icon: '💬',
    title: 'Quotation',
    altTitle: '報價單',
    accent: '#f97316',
    preview: ['報價單 QUO-001', '有效期 30日', '拍攝費用 _____', '後期費用 _____'],
  },
  {
    type: 'ig_script',
    icon: '📱',
    title: 'IG Script Template',
    altTitle: 'IG 腳本',
    accent: '#ec4899',
    preview: ['Hook _____', '背景介紹 _____', '轉場 _____', '結尾 _____'],
  },
  {
    type: 'youtube_script',
    icon: '▶',
    title: 'YouTube Script Template',
    altTitle: 'YouTube 腳本',
    accent: '#ef4444',
    preview: ['開場白 _____', '主題介紹 _____', '內容分段 _____', 'CTA _____'],
  },
] as const

const conceptBoardTemplate = {
  type: 'concept_board',
  icon: '💡',
  title: 'Concept Board',
  altTitle: '概念板',
  accent: '#06b6d4',
  preview: ['Concept 01 ___', '題目 ___', '副題 ___', '產品置入方向 ___'],
} as const

const blankTemplate = {
  type: 'blank',
  icon: '📄',
  title: 'Blank Document',
  altTitle: '空白文件',
  accent: '#6b7280',
  preview: [],
} as const

const meetingNotesTemplate = {
  type: 'meeting_notes',
  icon: '📅',
  title: 'Meeting Notes',
  altTitle: '會議記錄',
  accent: '#10b981',
  preview: [],
} as const

const campaignReportTemplate = {
  type: 'campaign_report',
  icon: '📊',
  title: 'Campaign Report',
  altTitle: '成效報告',
  accent: '#f59e0b',
  preview: [],
} as const

const acceptanceTemplate = {
  type: 'acceptance_engagement',
  icon: '🤝',
  title: 'Acceptance of Engagement',
  altTitle: '聘用確認書',
  accent: '#6366f1',
  preview: [],
} as const

const rundownTemplate = {
  type: 'rundown',
  icon: '✈️',
  title: 'Shooting Rundown',
  altTitle: '拍攝場景表',
  accent: '#0ea5e9',
  preview: [],
} as const

const docTemplates = [...templates, conceptBoardTemplate, blankTemplate, meetingNotesTemplate, campaignReportTemplate, acceptanceTemplate, rundownTemplate] as const

type Template = (typeof docTemplates)[number]

type DocFolder = {
  id: string
  name: string
  workspace_id: string | null
  created_at: string
}

type TripRow = {
  id: string
  name: string | null
  start_date: string
  end_date: string
}

type ShotRow = {
  id: string
  trip_id: string
  seq: number | null
  name: string | null
  day: number | null
  start_time: string | null
  time_of_day: string | null
  duration: string | null
  platform: string | null
  location: string | null
}

type RundownContent = {
  type: 'rundown'
  trip: {
    name: string
    date: string
    total_shots: number
  }
  shots: Array<{
    seq: number
    name: string
    day: number
    time: string
    time_of_day: string
    duration: string
    platform: string
    location: string
  }>
}

type Stakeholder = {
  name: string
  role: string
  involvement: string
}

type ProjectBriefContent = {
  language: BriefLang
  title: string
  projectName: string
  owner: string
  status: BriefStatus
  startDate: string
  targetDate: string
  team: string
  problemStatement: string
  goals: string
  successMetrics: string
  inScope: string
  outOfScope: string
  stakeholders: Stakeholder[]
  risks: string
  dependencies: string
  openQuestions: string
  updatedAt?: string
}

const templateLabels = Object.fromEntries(docTemplates.map((template) => [template.type, template.title]))
const templateIcons = Object.fromEntries(docTemplates.map((template) => [template.type, template.icon]))
const projectBriefStatusOptions: BriefStatus[] = ['Planning', 'In Progress', 'On Hold', 'Done']
const tommyUserId = 'bb3e47cc-90c8-4eac-a5ff-cabfcefb89ae'

function getDocKind(doc: CoreDoc | null | undefined) {
  return doc?.template_type || doc?.type || ''
}

const durationMinutes: Record<string, number> = {
  '30': 30,
  '60': 60,
  '120': 120,
  '180': 180,
  '240': 240,
  '360': 360,
  '30分': 30,
  '1小時': 60,
  '2小時': 120,
  '3小時': 180,
  '4小時': 240,
  '半日': 360,
}

const briefCopy = {
  zh: {
    toggle: '中文',
    back: '← 文件中心',
    save: 'Save',
    saved: '已儲存',
    saving: '儲存中...',
    exportPdf: '匯出 PDF',
    exportWord: '匯出 Word',
    meta: (created: string, updated: string) => `建立者 Tommy · 建立日期 ${created} · 最近更新 ${updated}`,
    fields: {
      projectName: '項目名稱',
      owner: '負責人',
      status: '狀態',
      startDate: '開始日期',
      targetDate: '目標日期',
      team: '團隊成員',
    },
    status: {
      Planning: '規劃中',
      'In Progress': '進行中',
      'On Hold': '暫停',
      Done: '完成',
    },
    sections: {
      problemStatement: '❓ 問題陳述',
      goalsMetrics: '🎯 目標與成功指標',
      scope: '📦 範圍',
      stakeholders: '👥 主要持份者',
      risksDependencies: '⚠️ 風險與依賴',
      openQuestions: '🤔 待解問題',
    },
    labels: {
      goals: '目標',
      successMetrics: '成功指標',
      inScope: '範圍內',
      outOfScope: '範圍外',
      risks: '風險',
      dependencies: '依賴項目',
    },
    placeholders: {
      problemStatement: '我們正在解決什麼問題？對象是誰？若不解決會有什麼影響？',
      goals: '目標 1\n目標 2',
      successMetrics: '指標 1\n指標 2',
      inScope: '範圍內項目',
      outOfScope: '範圍外項目',
      openQuestions: '問題 1\n問題 2',
    },
    stakeholderColumns: ['名稱', '角色', '參與程度'],
    addRow: '+ 新增',
  },
  en: {
    toggle: 'English',
    back: '← Docs Center',
    save: 'Save',
    saved: 'Saved',
    saving: 'Saving...',
    exportPdf: 'Export PDF',
    exportWord: 'Export Word',
    meta: (created: string, updated: string) => `Created by Tommy · Created ${created} · Last updated ${updated}`,
    fields: {
      projectName: 'Project name',
      owner: 'Owner',
      status: 'Status',
      startDate: 'Start date',
      targetDate: 'Target date',
      team: 'Team',
    },
    status: {
      Planning: 'Planning',
      'In Progress': 'In Progress',
      'On Hold': 'On Hold',
      Done: 'Done',
    },
    sections: {
      problemStatement: '❓ Problem Statement',
      goalsMetrics: '🎯 Goals and Success Metrics',
      scope: '📦 Scope',
      stakeholders: '👥 Key Stakeholders',
      risksDependencies: '⚠️ Risks and Dependencies',
      openQuestions: '🤔 Open Questions',
    },
    labels: {
      goals: 'Goals',
      successMetrics: 'How will we measure success?',
      inScope: 'In scope',
      outOfScope: 'Out of scope',
      risks: 'Risks',
      dependencies: 'Dependencies',
    },
    placeholders: {
      problemStatement: 'What problem are we solving? Who is it for? What happens if we do not solve it?',
      goals: 'Goal 1\nGoal 2',
      successMetrics: 'Metric 1\nMetric 2',
      inScope: 'Items in scope',
      outOfScope: 'Items out of scope',
      openQuestions: 'Question 1\nQuestion 2',
    },
    stakeholderColumns: ['Name', 'Role', 'Involvement'],
    addRow: '+ Add',
  },
} as const

const defaultProjectBrief: ProjectBriefContent = {
  language: 'zh',
  title: 'Project Brief',
  projectName: '',
  owner: '',
  status: 'Planning',
  startDate: '',
  targetDate: '',
  team: '',
  problemStatement: '',
  goals: '',
  successMetrics: '',
  inScope: '',
  outOfScope: '',
  stakeholders: [
    { name: '', role: '', involvement: '' },
    { name: '', role: '', involvement: '' },
  ],
  risks: '',
  dependencies: '',
  openQuestions: '',
}

export function DocsCenter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectForStoryboard = searchParams.get('select_for_storyboard') === 'true'
  const [docs, setDocs] = useState<CoreDoc[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [folders, setFolders] = useState<DocFolder[]>([])
  const [activeFolderId, setActiveFolderId] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<CoreDoc | null>(null)
  const [content, setContent] = useState('')
  const [projectBrief, setProjectBrief] = useState<ProjectBriefContent>(defaultProjectBrief)
  const [documentHeaderBase64, setDocumentHeaderBase64] = useState('')
  const [documentLogoBase64, setDocumentLogoBase64] = useState('')
  const [documentCompanyName, setDocumentCompanyName] = useState('SOON Studio')
  const { activeWorkspaceId: workspaceId, setActiveWorkspace } = useWorkspace()
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [toastMessage, setToastMessage] = useState('')
  const [activeDocTypeFilter, setActiveDocTypeFilter] = useState<'all' | 'rundown'>('all')
  const [rundownModalOpen, setRundownModalOpen] = useState(false)
  const [rundownTrips, setRundownTrips] = useState<TripRow[]>([])
  const [selectedRundownTripId, setSelectedRundownTripId] = useState('')
  const [rundownLoading, setRundownLoading] = useState(false)

  const copy = useMemo(() => briefCopy[projectBrief.language], [projectBrief.language])
  const hasDocSelection = selectedDocIds.length > 0
  const workspaceDocs = useMemo(
    () => docs.filter((doc) => !workspaceId || doc.workspace_id === workspaceId),
    [docs, workspaceId]
  )
  const visibleFolders = useMemo(
    () => folders.filter((folder) => !workspaceId || folder.workspace_id === workspaceId),
    [folders, workspaceId]
  )
  const visibleDocs = useMemo(
    () =>
      workspaceDocs.filter((doc) => {
        if (activeFolderId && doc.folder_id !== activeFolderId) return false
        if (activeDocTypeFilter === 'rundown' && getDocKind(doc) !== 'rundown') return false
        return true
      }),
    [activeDocTypeFilter, activeFolderId, workspaceDocs]
  )
  const allVisibleDocsSelected = visibleDocs.length > 0 && visibleDocs.every((doc) => selectedDocIds.includes(doc.id))
  const rundownDocCount = workspaceDocs.filter((doc) => getDocKind(doc) === 'rundown').length

  useEffect(() => {
    void load()
  }, [workspaceId])

  useEffect(() => {
    setSelectedDocIds([])
    if (activeFolderId && !visibleFolders.some((folder) => folder.id === activeFolderId)) {
      setActiveFolderId('')
    }
  }, [activeFolderId, visibleFolders, workspaceId])

  useEffect(() => {
    if (!selectedDoc || selectedDoc.template_type !== 'project_brief') return
    const interval = window.setInterval(() => {
      void saveProjectBrief(false)
    }, 30000)
    return () => window.clearInterval(interval)
  }, [selectedDoc, projectBrief])

  async function load() {
    const docsUrl = workspaceId ? `/api/docs?workspace_id=${encodeURIComponent(workspaceId)}` : '/api/docs'
    const response = await fetch(docsUrl, { cache: 'no-store' })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      window.alert(result.error || '載入文件失敗')
      setDocs([])
      setWorkspaces([])
      setFolders([])
      return
    }

    setDocs((result.docs ?? []) as CoreDoc[])
    setWorkspaces((result.workspaces ?? []) as Workspace[])
    setFolders((result.folders ?? []) as DocFolder[])
    setDocumentHeaderBase64(String(result.settings?.document_header_base64 ?? ''))
    setDocumentLogoBase64(String(result.settings?.logo_base64 ?? ''))
    setDocumentCompanyName(String(result.settings?.company_name ?? 'SOON Studio'))
    const openDocId = searchParams.get('open')
    const nextDocs = (result.docs ?? []) as CoreDoc[]
    const docToOpen = openDocId ? nextDocs.find((doc) => doc.id === openDocId) : null
    if (docToOpen) openDoc(docToOpen, nextDocs)
  }

  function notifyDocsChanged() {
    window.dispatchEvent(new Event('soon-data-updated'))
  }

  function calcEndTime(startTime: string, duration: string | null) {
    const minutesToAdd = (durationMinutes[duration || ''] ?? Number(duration || 0)) || 0
    const [hours, minutes] = startTime.split(':').map(Number)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return startTime

    const total = hours * 60 + minutes + minutesToAdd
    const endHours = Math.floor(total / 60) % 24
    const endMinutes = total % 60
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
  }

  function buildRundownContent(trip: TripRow, shots: ShotRow[]): RundownContent {
    return {
      type: 'rundown',
      trip: {
        name: trip.name || 'Untitled Trip',
        date: trip.start_date,
        total_shots: shots.length,
      },
      shots: shots.map((shot, index) => ({
        seq: shot.seq ?? index + 1,
        name: shot.name || '',
        day: shot.day ?? 0,
        time: shot.start_time ? `${shot.start_time} - ${calcEndTime(shot.start_time, shot.duration)}` : '-',
        time_of_day: shot.time_of_day || '',
        duration: shot.duration || '',
        platform: shot.platform || '',
        location: shot.location || '',
      })),
    }
  }

  async function loadRundownTrips() {
    setRundownLoading(true)
    const { data, error } = await supabase
      .from('trips')
      .select('id, name, start_date, end_date')
      .eq('user_id', tommyUserId)
      .order('start_date', { ascending: false })

    if (error) {
      console.error('[Rundown] load trips failed:', error)
      window.alert('載入行程失敗，請稍後再試。')
      setRundownLoading(false)
      return
    }

    const trips = (data || []) as TripRow[]
    setRundownTrips(trips)
    setSelectedRundownTripId((current) => current || trips[0]?.id || '')
    setRundownLoading(false)
  }

  async function openRundownModal() {
    setRundownModalOpen(true)
    if (rundownTrips.length === 0) {
      await loadRundownTrips()
    }
  }

  async function createRundownDocFromTrip() {
    const trip = rundownTrips.find((item) => item.id === selectedRundownTripId)
    if (!trip) return

    setRundownLoading(true)
    const { data: shotsData, error } = await supabase
      .from('shots')
      .select('id, trip_id, seq, name, day, start_time, time_of_day, duration, platform, location')
      .eq('trip_id', trip.id)
      .order('seq', { ascending: true })

    if (error) {
      console.error('[Rundown] load shots failed:', error)
      window.alert('載入場景失敗，請稍後再試。')
      setRundownLoading(false)
      return
    }

    const content = buildRundownContent(trip, (shotsData || []) as ShotRow[])
    const response = await fetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: tommyUserId,
        workspace_id: workspaceId || null,
        title: `${trip.name || 'Untitled Trip'} - Rundown`,
        type: 'rundown',
        template_type: 'rundown',
        content: JSON.stringify(content),
        created_at: new Date().toISOString(),
      }),
    })

    const result = await response.json().catch(() => ({}))
    setRundownLoading(false)

    if (!response.ok) {
      window.alert(result.error || '建立 Rundown 文件失敗。')
      return
    }

    const data = result.doc as CoreDoc
    setRundownModalOpen(false)
    notifyDocsChanged()
    showToast('✅ Rundown 已儲存至文件中心')
    openDoc(data, [data, ...docs])
  }

  function extractStoryboardScript(doc: CoreDoc) {
    const rawContent = doc.content ?? ''
    let parsed: any = rawContent

    if (typeof rawContent === 'string') {
      try {
        parsed = JSON.parse(rawContent)
      } catch {
        return rawContent
      }
    }

    if (typeof parsed === 'string') return parsed
    if (!parsed || typeof parsed !== 'object') return rawContent

    if (typeof parsed.qc_final === 'string') return parsed.qc_final
    if (typeof parsed.ai_draft === 'string') return parsed.ai_draft
    if (typeof parsed.script === 'string') return parsed.script
    if (typeof parsed.content === 'string') return parsed.content

    if (Array.isArray(parsed.segments)) {
      return parsed.segments
        .map((segment: any, index: number) => {
          const title = segment?.title || segment?.type || `段落 ${index + 1}`
          const time = segment?.suggestedTime ? `（${segment.suggestedTime}）` : ''
          const blocks = Array.isArray(segment?.blocks) ? segment.blocks : []
          const blockText = blocks
            .map((block: any) => {
              const type = String(block?.type || '').toLowerCase()
              const content = String(block?.content || '').trim()
              if (!content) return ''
              if (type.includes('scene') || type.includes('畫面') || type.includes('shot')) return `拍攝：${content}`
              if (type.includes('voice') || type.includes('vo') || type.includes('旁白')) return `VO：${content}`
              const speaker = block?.speaker || parsed.creator || '主持'
              return `${speaker}：${content}`
            })
            .filter(Boolean)
            .join('\n')

          return `${index + 1}. ${title}${time}${blockText ? `\n${blockText}` : ''}`
        })
        .join('\n\n')
    }

    return rawContent
  }

  function selectDocForStoryboard(doc: CoreDoc) {
    const script = extractStoryboardScript(doc)
    const message = {
      type: 'SOON_SCRIPT_SELECTED',
      script,
      topic: doc.title,
    }

    window.parent.postMessage(message, '*')
    const params = new URLSearchParams({ topic: doc.title, script })
    router.push(`/ig/storyboard?${params.toString()}`)
  }

  function getStoredBriefLanguage(): BriefLang {
    if (typeof window === 'undefined') return 'zh'
    return window.localStorage.getItem(briefLangStorageKey) === 'en' ? 'en' : 'zh'
  }

  function getStoredConceptLanguage() {
    if (typeof window === 'undefined') return 'zh'
    return window.localStorage.getItem(conceptBoardLangStorageKey) === 'en' ? 'en' : 'zh'
  }

  function getStoredYouTubeScriptLanguage() {
    if (typeof window === 'undefined') return 'zh'
    return window.localStorage.getItem(youtubeScriptLangStorageKey) === 'en' ? 'en' : 'zh'
  }

  function getStoredIGScriptLanguage() {
    if (typeof window === 'undefined') return 'zh'
    return window.localStorage.getItem(igScriptLangStorageKey) === 'en' ? 'en' : 'zh'
  }

  function getStoredMeetingNotesLanguage() {
    if (typeof window === 'undefined') return 'zh'
    return window.localStorage.getItem('soon-meeting-notes-lang') === 'en' ? 'en' : 'zh'
  }

  function getStoredCampaignReportLanguage() {
    if (typeof window === 'undefined') return 'zh'
    return window.localStorage.getItem('soon-campaign-report-lang') === 'en' ? 'en' : 'zh'
  }

  function getStoredAcceptanceLanguage() {
    if (typeof window === 'undefined') return 'en'
    return window.localStorage.getItem('soon-acceptance-lang') === 'zh' ? 'zh' : 'en'
  }

  async function createDoc(template: Template) {
    if (template.type === 'rundown') {
      await openRundownModal()
      return
    }

    const initialBrief = { ...defaultProjectBrief, language: getStoredBriefLanguage() }
    const initialConceptBoard = createEmptyConceptBoard(getStoredConceptLanguage())
    const initialYouTubeScript = createEmptyYouTubeScript(getStoredYouTubeScriptLanguage())
    const initialIGScript = createEmptyIGScript(getStoredIGScriptLanguage())
    const initialMeetingNotes = createEmptyMeetingNotes(getStoredMeetingNotesLanguage())
    const initialCampaignReport = createEmptyCampaignReport(getStoredCampaignReportLanguage())
    const initialAcceptance = createEmptyAcceptance(getStoredAcceptanceLanguage())
    const invoiceSettings = template.type === 'invoice' ? await reserveNextInvoiceSettings() : null
    const quoteSettings = template.type === 'quotation' ? await reserveNextQuoteSettings() : null
    const initialContent =
      template.type === 'project_brief'
        ? JSON.stringify(initialBrief)
        : template.type === 'concept_board'
          ? JSON.stringify(initialConceptBoard)
        : template.type === 'youtube_script'
          ? JSON.stringify(initialYouTubeScript)
        : template.type === 'ig_script'
          ? JSON.stringify(initialIGScript)
        : template.type === 'meeting_notes'
          ? JSON.stringify(initialMeetingNotes)
        : template.type === 'campaign_report'
          ? JSON.stringify(initialCampaignReport)
        : template.type === 'acceptance_engagement'
          ? JSON.stringify(initialAcceptance)
        : template.type === 'invoice'
          ? JSON.stringify(createEmptyInvoice(invoiceSettings ?? defaultSettings))
        : template.type === 'quotation'
          ? JSON.stringify(createEmptyQuotation(quoteSettings ?? defaultQuotationSettings))
        : ''

    const response = await fetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: template.title,
        template_type: template.type,
        workspace_id: workspaceId || null,
        content: initialContent,
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      window.alert(result.error || '建立文件失敗')
      return
    }

    const data = result.doc as CoreDoc
    notifyDocsChanged()
    openDoc(data, [data, ...docs])
  }

  async function reserveNextInvoiceSettings(): Promise<InvoiceSettings> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return defaultSettings

    const { data } = await supabase.from('settings').select('*').eq('user_id', user.id).limit(1).maybeSingle()
    const settings: InvoiceSettings = data
      ? {
          display_name: data.display_name ?? 'Tommy',
          logo_base64: data.logo_base64 ?? '',
          document_header_base64: data.document_header_base64 ?? '',
          company_name: data.company_name ?? 'SOON Studio',
          email: data.email ?? '',
          phone: data.phone ?? '',
          address: data.address ?? '',
          bank_name: data.bank_name ?? '',
          account_name: data.account_name ?? '',
          account_number: data.account_number ?? '',
          default_currency: normaliseCurrency(data.default_currency),
          invoice_prefix: data.invoice_prefix ?? 'INV',
          invoice_start_number: Number(data.invoice_start_number ?? 1),
          invoice_current_number: Number(data.invoice_current_number ?? 0),
          tax_rate: Number(data.tax_rate ?? 0),
          default_rates: (data.default_rates ?? {}) as Record<string, number>,
        }
      : defaultSettings

    const nextNumber = settings.invoice_current_number > 0 ? settings.invoice_current_number + 1 : settings.invoice_start_number
    const { error } = await supabase.from('settings').upsert(
      {
        user_id: user.id,
        invoice_prefix: settings.invoice_prefix,
        invoice_start_number: settings.invoice_start_number,
        invoice_current_number: nextNumber,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    if (error) {
      console.warn('Invoice number counter could not be reserved. Falling back to local invoice number.', error.message)
    }

    return settings
  }

  async function reserveNextQuoteSettings(): Promise<QuotationSettings> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return defaultQuotationSettings

    const { data } = await supabase.from('settings').select('*').eq('user_id', user.id).limit(1).maybeSingle()
    const settings = mergeQuotationSettings(data)
    const nextNumber = Number(settings.quote_current_number ?? 0) + 1 || 1

    const { error } = await supabase.from('settings').upsert(
      {
        user_id: user.id,
        quote_prefix: settings.quote_prefix,
        quote_current_number: nextNumber,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    if (error) {
      console.warn('Quote number counter could not be reserved. Falling back to local quote number.', error.message)
    }

    return settings
  }

  async function deleteDoc(doc: CoreDoc) {
    const confirmed = window.confirm('確定刪除此文件？此動作不可撤回')
    if (!confirmed) return

    const response = await fetch('/api/docs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [doc.id] }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      window.alert(result.error || '刪除文件失敗')
      return
    }

    if (selectedDoc?.id === doc.id) {
      setSelectedDoc(null)
      setContent('')
      setSaveState('idle')
    }
    setDocs((current) => current.filter((item) => item.id !== doc.id))
    notifyDocsChanged()
    await load()
  }

  function showToast(message: string) {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(''), 2400)
  }

  function toggleDocSelection(docId: string, checked: boolean) {
    setSelectedDocIds((current) =>
      checked ? Array.from(new Set([...current, docId])) : current.filter((id) => id !== docId)
    )
  }

  function toggleAllDocs(checked: boolean) {
    setSelectedDocIds(checked ? visibleDocs.map((doc) => doc.id) : [])
  }

  async function createFolder() {
    const name = newFolderName.trim()
    if (!name) return

    console.log('[Folder] Creating:', name, 'workspace:', workspaceId)
    const response = await fetch('/api/docs/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, workspace_id: workspaceId }),
    })
    const result = await response.json().catch(() => ({}))
    console.log('[Folder] Result:', result)

    if (!response.ok) {
      window.alert(result.error || '新增文件夾失敗')
      return
    }
    setNewFolderName('')
    setCreatingFolder(false)
    await load()
  }

  async function renameFolder(folder: DocFolder) {
    const name = window.prompt('新文件夾名稱', folder.name)?.trim()
    if (!name) return

    const response = await fetch('/api/docs/folders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: folder.id, name }),
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      window.alert(result.error || '重命名文件夾失敗')
      return
    }
    await load()
  }

  async function deleteFolder(folder: DocFolder) {
    if (!window.confirm(`確定刪除文件夾「${folder.name}」？文件會保留並移出文件夾。`)) return

    const response = await fetch('/api/docs/folders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: folder.id }),
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      window.alert(result.error || '刪除文件夾失敗')
      return
    }
    if (activeFolderId === folder.id) setActiveFolderId('')
    await load()
  }

  async function moveDocToFolder(docId: string, folderId: string) {
    const response = await fetch('/api/docs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: docId, folder_id: folderId || null }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      window.alert(result.error || '移動文件失敗')
      return
    }
    setDocs((current) => current.map((doc) => (doc.id === docId ? { ...doc, folder_id: folderId || null } : doc)))
    await load()
  }

  async function deleteSelectedDocs() {
    const count = selectedDocIds.length
    if (count === 0) return

    const confirmed = window.confirm(`確定刪除 ${count} 份文件？此動作不可撤回`)
    if (!confirmed) return

    const response = await fetch('/api/docs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedDocIds }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      window.alert(result.error || '刪除文件失敗')
      return
    }

    if (selectedDoc && selectedDocIds.includes(selectedDoc.id)) {
      setSelectedDoc(null)
      setContent('')
      setSaveState('idle')
    }

    setDocs((current) => current.filter((doc) => !selectedDocIds.includes(doc.id)))
    setSelectedDocIds([])
    notifyDocsChanged()
    showToast(`已刪除 ${count} 份文件`)
    await load()
  }

  async function saveDoc() {
    if (!selectedDoc) return
    const response = await fetch('/api/docs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedDoc.id, content }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      window.alert(result.error || '儲存文件失敗')
      return
    }
    setSaveState('saved')
    await load()
  }

  async function saveProjectBrief(showAlert = true) {
    if (!selectedDoc || selectedDoc.template_type !== 'project_brief') return

    const nextContent = { ...projectBrief, updatedAt: new Date().toISOString() }
    setSaveState('saving')
    const response = await fetch('/api/docs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedDoc.id,
        title: nextContent.title || 'Project Brief',
        content: JSON.stringify(nextContent),
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (showAlert) window.alert(result.error || '儲存文件失敗')
      setSaveState('idle')
      return
    }

    const data = result.doc as CoreDoc
    setProjectBrief(nextContent)
    setSelectedDoc(data)
    setDocs((current) => current.map((doc) => (doc.id === selectedDoc.id ? data : doc)))
    setSaveState('saved')
  }

  function exportPdf() {
    window.print()
  }

  function exportWord() {
    const html = buildWordHtml(projectBrief, copy, selectedDoc?.created_at ?? new Date().toISOString())
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${sanitizeFilename(projectBrief.projectName || projectBrief.title || 'project')}-brief.doc`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  function openDoc(doc: CoreDoc, nextDocs = docs) {
    setSelectedDoc(doc)
    setSaveState('idle')
    if (doc.template_type === 'project_brief') {
      const parsed = parseProjectBrief(doc.content, getStoredBriefLanguage())
      setProjectBrief(parsed)
      window.localStorage.setItem(briefLangStorageKey, parsed.language)
    } else {
      setContent(doc.content ?? '')
    }
    setDocs(nextDocs)
  }

  function closeDoc() {
    setSelectedDoc(null)
    setSaveState('idle')
  }

  function setBriefLanguage(language: BriefLang) {
    window.localStorage.setItem(briefLangStorageKey, language)
    setProjectBrief((current) => ({ ...current, language }))
    setSaveState('idle')
  }

  function updateProjectBrief<K extends keyof ProjectBriefContent>(key: K, value: ProjectBriefContent[K]) {
    setProjectBrief((current) => ({ ...current, [key]: value }))
    setSaveState('idle')
  }

  function updateStakeholder(index: number, key: keyof Stakeholder, value: string) {
    setProjectBrief((current) => ({
      ...current,
      stakeholders: current.stakeholders.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }))
    setSaveState('idle')
  }

  function addStakeholder() {
    setProjectBrief((current) => ({
      ...current,
      stakeholders: [...current.stakeholders, { name: '', role: '', involvement: '' }],
    }))
    setSaveState('idle')
  }

  if (selectedDoc?.template_type === 'project_brief') {
    const createdDate = formatDate(selectedDoc.created_at)
    const updatedDate = formatDate(projectBrief.updatedAt ?? selectedDoc.created_at)

    return (
      <DashboardShell activeSection="docs">
        <section className="brief-editor-page">
          <header className="brief-toolbar soon-no-print">
            <div className="brief-toolbar-left">
              <button className="soon-no-print" type="button" onClick={closeDoc}>
                {copy.back}
              </button>
              <div className="brief-language-toggle" aria-label="Project brief language">
                {(['zh', 'en'] as BriefLang[]).map((language) => (
                  <button
                    key={language}
                    type="button"
                    className={projectBrief.language === language ? 'active' : ''}
                    onClick={() => setBriefLanguage(language)}
                  >
                    {briefCopy[language].toggle}
                  </button>
                ))}
              </div>
            </div>
            <input
              aria-label="文件標題"
              value={projectBrief.title}
              onChange={(event) => updateProjectBrief('title', event.target.value)}
            />
            <div className="brief-toolbar-actions">
              {saveState === 'saved' && <span>{copy.saved}</span>}
              {saveState === 'saving' && <span>{copy.saving}</span>}
              <button className="export-button export-pdf-button soon-no-print" type="button" onClick={exportPdf}>
                {copy.exportPdf}
              </button>
              <button className="export-button export-word-button soon-no-print" type="button" onClick={exportWord}>
                {copy.exportWord}
              </button>
              <button className="primary-button" type="button" onClick={() => void saveProjectBrief()}>
                {copy.save}
              </button>
            </div>
          </header>

          <article className="brief-document soon-print-doc">
            {documentHeaderBase64 && <img className="document-header-banner" src={documentHeaderBase64} alt="" />}
            <div className="doc-logo-area">
              <DocumentBrandMark logoBase64={documentLogoBase64} companyName={documentCompanyName} />
            </div>
            <input
              className="brief-title-input"
              value={projectBrief.title}
              onChange={(event) => updateProjectBrief('title', event.target.value)}
            />
            <div className="brief-meta">{copy.meta(createdDate, updatedDate)}</div>

            <table className="brief-info-table">
              <tbody>
                <BriefInfoRow label={copy.fields.projectName}>
                  <input
                    value={projectBrief.projectName}
                    onChange={(event) => updateProjectBrief('projectName', event.target.value)}
                  />
                </BriefInfoRow>
                <BriefInfoRow label={copy.fields.owner}>
                  <input
                    value={projectBrief.owner}
                    onChange={(event) => updateProjectBrief('owner', event.target.value)}
                  />
                </BriefInfoRow>
                <BriefInfoRow label={copy.fields.status}>
                  <select
                    value={projectBrief.status}
                    onChange={(event) => updateProjectBrief('status', event.target.value as BriefStatus)}
                  >
                    {projectBriefStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {copy.status[status]}
                      </option>
                    ))}
                  </select>
                </BriefInfoRow>
                <BriefInfoRow label={copy.fields.startDate}>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="YYYY-MM-DD"
                    value={projectBrief.startDate}
                    onChange={(event) => updateProjectBrief('startDate', event.target.value)}
                  />
                </BriefInfoRow>
                <BriefInfoRow label={copy.fields.targetDate}>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="YYYY-MM-DD"
                    value={projectBrief.targetDate}
                    onChange={(event) => updateProjectBrief('targetDate', event.target.value)}
                  />
                </BriefInfoRow>
                <BriefInfoRow label={copy.fields.team}>
                  <input value={projectBrief.team} onChange={(event) => updateProjectBrief('team', event.target.value)} />
                </BriefInfoRow>
              </tbody>
            </table>

            <BriefSection title={copy.sections.problemStatement}>
              <AutoTextarea
                value={projectBrief.problemStatement}
                placeholder={copy.placeholders.problemStatement}
                onChange={(value) => updateProjectBrief('problemStatement', value)}
              />
            </BriefSection>

            <BriefSection title={copy.sections.goalsMetrics}>
              <BriefSubsection label={copy.labels.goals}>
                <AutoTextarea
                  value={projectBrief.goals}
                  placeholder={copy.placeholders.goals}
                  onChange={(value) => updateProjectBrief('goals', value)}
                />
              </BriefSubsection>
              <BriefSubsection label={copy.labels.successMetrics}>
                <AutoTextarea
                  value={projectBrief.successMetrics}
                  placeholder={copy.placeholders.successMetrics}
                  onChange={(value) => updateProjectBrief('successMetrics', value)}
                />
              </BriefSubsection>
            </BriefSection>

            <BriefSection title={copy.sections.scope}>
              <BriefSubsection label={copy.labels.inScope}>
                <AutoTextarea
                  value={projectBrief.inScope}
                  placeholder={copy.placeholders.inScope}
                  onChange={(value) => updateProjectBrief('inScope', value)}
                />
              </BriefSubsection>
              <BriefSubsection label={copy.labels.outOfScope}>
                <AutoTextarea
                  value={projectBrief.outOfScope}
                  placeholder={copy.placeholders.outOfScope}
                  onChange={(value) => updateProjectBrief('outOfScope', value)}
                />
              </BriefSubsection>
            </BriefSection>

            <BriefSection title={copy.sections.stakeholders}>
              <table className="stakeholder-table">
                <thead>
                  <tr>
                    {copy.stakeholderColumns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projectBrief.stakeholders.map((stakeholder, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          value={stakeholder.name}
                          onChange={(event) => updateStakeholder(index, 'name', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          value={stakeholder.role}
                          onChange={(event) => updateStakeholder(index, 'role', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          value={stakeholder.involvement}
                          onChange={(event) => updateStakeholder(index, 'involvement', event.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="add-row-button soon-no-print" type="button" onClick={addStakeholder}>
                {copy.addRow}
              </button>
            </BriefSection>

            <BriefSection title={copy.sections.risksDependencies}>
              <BriefSubsection label={copy.labels.risks}>
                <AutoTextarea value={projectBrief.risks} onChange={(value) => updateProjectBrief('risks', value)} />
              </BriefSubsection>
              <BriefSubsection label={copy.labels.dependencies}>
                <AutoTextarea
                  value={projectBrief.dependencies}
                  onChange={(value) => updateProjectBrief('dependencies', value)}
                />
              </BriefSubsection>
            </BriefSection>

            <BriefSection title={copy.sections.openQuestions}>
              <AutoTextarea
                value={projectBrief.openQuestions}
                placeholder={copy.placeholders.openQuestions}
                onChange={(value) => updateProjectBrief('openQuestions', value)}
              />
            </BriefSection>
          </article>
        </section>
      </DashboardShell>
    )
  }

  if (selectedDoc?.template_type === 'invoice') {
    return (
      <DashboardShell activeSection="docs">
        <InvoiceEditor
          doc={selectedDoc}
          onBack={closeDoc}
          onSaved={(doc) => {
            setSelectedDoc(doc)
            setDocs((current) => current.map((item) => (item.id === doc.id ? doc : item)))
          }}
        />
      </DashboardShell>
    )
  }

  if (selectedDoc?.template_type === 'quotation') {
    return (
      <DashboardShell activeSection="docs">
        <QuotationEditor
          doc={selectedDoc}
          onBack={closeDoc}
          onSaved={(doc) => {
            setSelectedDoc(doc)
            setDocs((current) => current.map((item) => (item.id === doc.id ? doc : item)))
          }}
        />
      </DashboardShell>
    )
  }

  if (selectedDoc?.template_type === 'concept_board') {
    return (
      <DashboardShell activeSection="docs">
        <ConceptBoardEditor
          doc={selectedDoc}
          onBack={closeDoc}
          onSaved={(doc) => {
            setSelectedDoc(doc)
            setDocs((current) => current.map((item) => (item.id === doc.id ? doc : item)))
            notifyDocsChanged()
          }}
        />
      </DashboardShell>
    )
  }

  if (selectedDoc?.template_type === 'youtube_script') {
    return (
      <DashboardShell activeSection="docs">
        <YouTubeScriptEditor
          doc={selectedDoc}
          onBack={closeDoc}
          onSaved={(doc) => {
            setSelectedDoc(doc)
            setDocs((current) => current.map((item) => (item.id === doc.id ? doc : item)))
            notifyDocsChanged()
          }}
        />
      </DashboardShell>
    )
  }

  if (selectedDoc?.template_type === 'ig_script') {
    return (
      <DashboardShell activeSection="docs">
        <IGScriptEditor
          doc={selectedDoc}
          onBack={closeDoc}
          onSaved={(doc) => {
            setSelectedDoc(doc)
            setDocs((current) => current.map((item) => (item.id === doc.id ? doc : item)))
            notifyDocsChanged()
          }}
        />
      </DashboardShell>
    )
  }

  if (selectedDoc?.template_type === 'blank') {
    return (
      <DashboardShell activeSection="docs">
        <BlankDocumentEditor
          doc={selectedDoc}
          onBack={closeDoc}
          onSaved={(doc) => {
            setSelectedDoc(doc)
            setDocs((current) => current.map((item) => (item.id === doc.id ? doc : item)))
            notifyDocsChanged()
          }}
        />
      </DashboardShell>
    )
  }

  if (selectedDoc?.template_type === 'meeting_notes') {
    return (
      <DashboardShell activeSection="docs">
        <MeetingNotesEditor
          doc={selectedDoc}
          onBack={closeDoc}
          onSaved={(doc) => {
            setSelectedDoc(doc)
            setDocs((current) => current.map((item) => (item.id === doc.id ? doc : item)))
            notifyDocsChanged()
          }}
        />
      </DashboardShell>
    )
  }

  if (selectedDoc?.template_type === 'campaign_report') {
    return (
      <DashboardShell activeSection="docs">
        <CampaignReportEditor
          doc={selectedDoc}
          onBack={closeDoc}
          onSaved={(doc) => {
            setSelectedDoc(doc)
            setDocs((current) => current.map((item) => (item.id === doc.id ? doc : item)))
            notifyDocsChanged()
          }}
        />
      </DashboardShell>
    )
  }

  if (selectedDoc?.template_type === 'acceptance_engagement') {
    return (
      <DashboardShell activeSection="docs">
        <AcceptanceOfEngagementEditor
          doc={selectedDoc}
          onBack={closeDoc}
          onSaved={(doc) => {
            setSelectedDoc(doc)
            setDocs((current) => current.map((item) => (item.id === doc.id ? doc : item)))
            notifyDocsChanged()
          }}
        />
      </DashboardShell>
    )
  }

  if (selectedDoc && getDocKind(selectedDoc) === 'rundown') {
    return (
      <DashboardShell activeSection="docs">
        <RundownViewer
          doc={selectedDoc}
          onBack={closeDoc}
          logoBase64={documentLogoBase64}
          companyName={documentCompanyName}
        />
      </DashboardShell>
    )
  }

  return (
    <DashboardShell activeSection="docs">
      <section className="docs-page">
        <PageHeader
          icon="📄"
          title="文件中心"
          subtitle="建立常用製作文件同模板"
          actions={(
            <>
            <select
              value={workspaceId}
              onChange={(event) => {
                const selected = workspaces.find((workspace) => workspace.id === event.target.value)
                setActiveWorkspace(selected?.id ?? '', selected?.name ?? '')
                setActiveFolderId('')
                setSelectedDocIds([])
              }}
            >
              <option value="">全部工作區</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <button className="blank-doc-button" type="button" onClick={() => void createDoc(blankTemplate)}>
              空白文件
            </button>
            </>
          )}
        />

        <div style={{ position: 'relative', width: '100%', height: '12rem', borderRadius: '12px', overflow: 'hidden', margin: '0 28px 24px' }}>
          <Image
            src="/document-banner.jpg"
            alt="文件中心"
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="template-grid docs-template-grid">
          {docTemplates.map((template) => (
            <article key={template.type} className="template-card docs-template-card">
              <div className="template-accent" style={{ background: template.accent }} />
              <div className="template-title-row">
                <span className="template-icon" style={{ color: template.accent }}>
                  {template.type === 'invoice' ? <InvoiceTemplateIcon /> : template.type === 'concept_board' ? <ConceptTemplateIcon /> : template.type === 'blank' ? <DocumentTemplateIcon /> : template.type === 'meeting_notes' ? <CalendarTemplateIcon /> : template.type === 'campaign_report' ? <ChartTemplateIcon /> : template.type === 'acceptance_engagement' ? <HandshakeTemplateIcon /> : template.icon}
                </span>
                <div>
                  <h2>{template.title}</h2>
                  <p>{template.altTitle}</p>
                </div>
              </div>
              <button className="template-create-button" type="button" onClick={() => void createDoc(template)}>
                新建
              </button>
            </article>
          ))}
        </div>

        <section className="existing-docs-section">
          <h2>已有文件</h2>
          {toastMessage && <div className="docs-toast">{toastMessage}</div>}
            <div className="doc-folder-panel">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setActiveDocTypeFilter('all')}
                style={{
                  background: activeDocTypeFilter === 'all' ? 'rgba(124,92,252,0.18)' : 'transparent',
                  border: '1px solid #2a2a3a',
                  borderRadius: '999px',
                  color: '#f0f0f5',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '6px 12px',
                }}
              >
                全部 {workspaceDocs.length}
              </button>
              <button
                type="button"
                onClick={() => setActiveDocTypeFilter('rundown')}
                style={{
                  background: activeDocTypeFilter === 'rundown' ? 'rgba(14,165,233,0.18)' : 'transparent',
                  border: '1px solid #0ea5e9',
                  borderRadius: '999px',
                  color: '#f0f0f5',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '6px 12px',
                }}
              >
                📋 場景表 {rundownDocCount}
              </button>
            </div>
            <div className="doc-folder-row-wrap">
              <button
                className={activeFolderId === '' ? 'doc-folder-row active' : 'doc-folder-row'}
                type="button"
                onClick={() => setActiveFolderId('')}
              >
                <span>全部</span>
                <small>{workspaceDocs.length}</small>
              </button>
              {visibleFolders.map((folder) => {
                const count = workspaceDocs.filter((doc) => doc.folder_id === folder.id).length
                return (
                  <div key={folder.id} className={activeFolderId === folder.id ? 'doc-folder-row active' : 'doc-folder-row'}>
                    <button type="button" onClick={() => setActiveFolderId(folder.id)}>
                      <span>📁 {folder.name}</span>
                      <small>{count}</small>
                    </button>
                    <div className="doc-folder-actions">
                      <button type="button" onClick={() => void renameFolder(folder)}>重命名</button>
                      <button type="button" onClick={() => void deleteFolder(folder)}>刪除</button>
                    </div>
                  </div>
                )
              })}
            </div>
            {creatingFolder ? (
              <div className="new-folder-inline">
                <input
                  autoFocus
                  value={newFolderName}
                  placeholder="文件夾名稱"
                  onChange={(event) => setNewFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void createFolder()
                    if (event.key === 'Escape') setCreatingFolder(false)
                  }}
                />
                <button type="button" onClick={() => void createFolder()}>確認</button>
                <button type="button" onClick={() => setCreatingFolder(false)}>取消</button>
              </div>
            ) : (
              <button className="add-folder-button" type="button" onClick={() => setCreatingFolder(true)}>
                + 新增文件夾
              </button>
            )}
          </div>
          {hasDocSelection && (
            <div className="docs-bulk-action-bar">
              <span>已選取 {selectedDocIds.length} 份文件</span>
              <span className="docs-bulk-spacer" />
              <button className="docs-ghost-button" type="button" onClick={() => setSelectedDocIds([])}>
                取消選取
              </button>
              <button className="docs-bulk-delete-button" type="button" onClick={() => void deleteSelectedDocs()}>
                刪除所選
              </button>
            </div>
          )}
          <div className="existing-docs-list">
            {visibleDocs.length > 0 && (
              <div className={hasDocSelection ? 'docs-list-header selection-visible' : 'docs-list-header'}>
                <label className="doc-checkbox-wrap">
                  <input
                    aria-label="全選文件"
                    checked={allVisibleDocsSelected}
                    type="checkbox"
                    onChange={(event) => toggleAllDocs(event.target.checked)}
                  />
                </label>
                <span>文件</span>
                <span>類型</span>
                <span>日期</span>
                <span />
              </div>
            )}
            {visibleDocs.map((doc) => {
              const isChecked = selectedDocIds.includes(doc.id)
              const docKind = getDocKind(doc)
              const rowClassName = [
                'doc-row',
                selectedDoc?.id === doc.id ? 'active' : '',
                isChecked ? 'selected' : '',
                hasDocSelection ? 'selection-visible' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
              <div key={doc.id} className={rowClassName}>
                <label className="doc-checkbox-wrap">
                  <input
                    aria-label={`選取 ${doc.title}`}
                    checked={isChecked}
                    type="checkbox"
                    onChange={(event) => toggleDocSelection(doc.id, event.target.checked)}
                  />
                </label>
                <span className="doc-row-icon">{templateIcons[docKind] ?? '📄'}</span>
                <strong>{doc.title}</strong>
                <span className="doc-type-badge">
                  {templateLabels[docKind] ?? docKind ?? 'Document'}
                </span>
                <time>{new Date(doc.created_at).toLocaleDateString('zh-HK')}</time>
                <div className="doc-row-actions">
                  {selectForStoryboard && doc.template_type === 'ig_script' && (
                    <button type="button" onClick={() => selectDocForStoryboard(doc)}>
                      選取
                    </button>
                  )}
                  <select
                    className="doc-move-select"
                    value={doc.folder_id ?? ''}
                    onChange={(event) => void moveDocToFolder(doc.id, event.target.value)}
                  >
                    <option value="">移至：無文件夾</option>
                    {visibleFolders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        移至：{folder.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => openDoc(doc)}>
                    開啟
                  </button>
                  <button className="doc-delete-button" type="button" onClick={() => void deleteDoc(doc)}>
                    刪除
                  </button>
                </div>
              </div>
              )
            })}
            {visibleDocs.length === 0 && <p className="docs-empty">未有文件</p>}
          </div>
        </section>

        <section className="doc-editor">
          {selectedDoc ? (
            <>
              <div className="panel-head">
                <h2>{selectedDoc.title}</h2>
                <button className="primary-button" type="button" onClick={() => void saveDoc()}>
                  儲存
                </button>
              </div>
              <textarea
                value={content}
                onChange={(event) => {
                  setContent(event.target.value)
                  setSaveState('idle')
                }}
                placeholder="開始撰寫文件內容..."
              />
            </>
          ) : (
            <div className="empty-card">選擇或新建一份文件開始編輯</div>
          )}
        </section>

        {rundownModalOpen && (
          <>
            <div
              onClick={() => setRundownModalOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                zIndex: 80,
              }}
            />
            <div
              style={{
                position: 'fixed',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(520px, calc(100vw - 40px))',
                background: '#16161f',
                border: '1px solid #2a2a3a',
                borderRadius: '14px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
                padding: '22px',
                zIndex: 81,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '18px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', color: '#0ea5e9', fontSize: '12px', fontWeight: 600 }}>Shooting Rundown</p>
                  <h2 style={{ margin: 0, color: '#f0f0f5', fontSize: '18px' }}>選擇行程建立場景表</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setRundownModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: '#9090a8', cursor: 'pointer', fontSize: '22px' }}
                >
                  ×
                </button>
              </div>

              <label style={{ display: 'block', color: '#f0f0f5', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                已有行程
              </label>
              <select
                value={selectedRundownTripId}
                onChange={(event) => setSelectedRundownTripId(event.target.value)}
                style={{
                  width: '100%',
                  background: '#111118',
                  border: '1px solid #2a2a3a',
                  borderRadius: '8px',
                  color: '#f0f0f5',
                  padding: '10px 12px',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {rundownTrips.length === 0 && <option value="">未有行程</option>}
                {rundownTrips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name || 'Untitled Trip'} · {new Date(trip.start_date).toLocaleDateString('zh-HK')}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={!selectedRundownTripId || rundownLoading}
                onClick={() => void createRundownDocFromTrip()}
                style={{
                  width: '100%',
                  background: '#0ea5e9',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: selectedRundownTripId && !rundownLoading ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  fontWeight: 600,
                  opacity: selectedRundownTripId && !rundownLoading ? 1 : 0.55,
                  padding: '11px 16px',
                }}
              >
                {rundownLoading ? '建立中...' : '建立 Rundown 文件'}
              </button>
            </div>
          </>
        )}
      </section>
    </DashboardShell>
  )
}

function parseRundownContent(content: string | null): RundownContent {
  const fallback: RundownContent = {
    type: 'rundown',
    trip: { name: 'Shooting Rundown', date: '', total_shots: 0 },
    shots: [],
  }

  if (!content) return fallback

  try {
    const parsed = JSON.parse(content) as Partial<RundownContent>
    const shots = Array.isArray(parsed.shots)
      ? parsed.shots.map((shot: any, index) => ({
          seq: Number(shot.seq ?? index + 1),
          name: String(shot.name ?? ''),
          day: Number(shot.day ?? 0),
          time: String(shot.time ?? '-'),
          time_of_day: String(shot.time_of_day ?? ''),
          duration: String(shot.duration ?? ''),
          platform: String(shot.platform ?? ''),
          location: String(shot.location ?? ''),
        }))
      : []

    return {
      type: 'rundown',
      trip: {
        name: parsed.trip?.name || 'Shooting Rundown',
        date: parsed.trip?.date || '',
        total_shots: Number(parsed.trip?.total_shots ?? shots.length),
      },
      shots,
    }
  } catch {
    return fallback
  }
}

function RundownViewer({
  doc,
  onBack,
  logoBase64,
  companyName,
}: {
  doc: CoreDoc
  onBack: () => void
  logoBase64: string
  companyName: string
}) {
  const rundown = parseRundownContent(doc.content)

  return (
    <section className="brief-editor-page">
      <div className="brief-toolbar">
        <button type="button" onClick={onBack}>
          ← 文件中心
        </button>
        <button type="button" onClick={() => window.print()}>
          匯出 PDF
        </button>
      </div>

      <article
        className="soon-print-doc"
        style={{
          maxWidth: '980px',
          margin: '0 auto 48px',
          background: '#fff',
          color: '#111',
          borderRadius: '12px',
          padding: '42px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', marginBottom: '30px' }}>
          <div>
            {logoBase64 ? (
              <img
                src={logoBase64}
                alt="Logo"
                style={{ height: '72px', maxWidth: '220px', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <strong style={{ display: 'block', fontSize: '18px', marginBottom: '10px' }}>
                {companyName || 'SOON Studio'}
              </strong>
            )}
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#555' }}>Shooting Rundown</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ margin: 0, fontSize: '28px', lineHeight: 1.2 }}>{rundown.trip.name}</h1>
            <p style={{ margin: '10px 0 0', fontSize: '13px', color: '#555' }}>
              日期：{rundown.trip.date ? formatDate(rundown.trip.date) : '-'} · 場景數：{rundown.trip.total_shots}
            </p>
          </div>
        </header>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              {['#', '拍攝日', '時間', '片段名稱', '拍攝時段', '時長', '平台', '地點'].map((label) => (
                <th
                  key={label}
                  style={{
                    border: '1px solid #d4d4d8',
                    background: '#f4f4f5',
                    color: '#111',
                    padding: '10px 8px',
                    textAlign: 'left',
                    fontWeight: 700,
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rundown.shots.map((shot) => (
              <tr key={`${shot.seq}-${shot.name}`}>
                <td style={{ border: '1px solid #e4e4e7', padding: '9px 8px' }}>{shot.seq}</td>
                <td style={{ border: '1px solid #e4e4e7', padding: '9px 8px' }}>D{(shot.day || 0) + 1}</td>
                <td style={{ border: '1px solid #e4e4e7', padding: '9px 8px', whiteSpace: 'nowrap' }}>{shot.time}</td>
                <td style={{ border: '1px solid #e4e4e7', padding: '9px 8px', fontWeight: 600 }}>{shot.name || '-'}</td>
                <td style={{ border: '1px solid #e4e4e7', padding: '9px 8px' }}>{shot.time_of_day || '-'}</td>
                <td style={{ border: '1px solid #e4e4e7', padding: '9px 8px' }}>{shot.duration || '-'}</td>
                <td style={{ border: '1px solid #e4e4e7', padding: '9px 8px' }}>{shot.platform || '-'}</td>
                <td style={{ border: '1px solid #e4e4e7', padding: '9px 8px' }}>{shot.location || '-'}</td>
              </tr>
            ))}
            {rundown.shots.length === 0 && (
              <tr>
                <td colSpan={8} style={{ border: '1px solid #e4e4e7', padding: '24px', textAlign: 'center' }}>
                  未有場景
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </section>
  )
}

function InvoiceTemplateIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function ConceptTemplateIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M8.5 14.5c-1.8-1.2-3-3.1-3-5.3A6.5 6.5 0 0 1 12 2.7a6.5 6.5 0 0 1 6.5 6.5c0 2.2-1.2 4.1-3 5.3-.7.5-1 1.2-1 2H9.5c0-.8-.3-1.5-1-2Z" />
    </svg>
  )
}

function DocumentTemplateIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </svg>
  )
}

function CalendarTemplateIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
    </svg>
  )
}

function ChartTemplateIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <rect x="7" y="11" width="3" height="5" rx="1" />
      <rect x="12" y="7" width="3" height="9" rx="1" />
      <rect x="17" y="3" width="3" height="13" rx="1" />
    </svg>
  )
}

function HandshakeTemplateIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m11 17 2 2a2.8 2.8 0 0 0 4 0l3-3a2.8 2.8 0 0 0 0-4l-4-4" />
      <path d="m13 7 1.5-1.5a3 3 0 0 1 4.2 0L21 7.8" />
      <path d="m3 7.8 2.3-2.3a3 3 0 0 1 4.2 0L12 8" />
      <path d="m7 13 2 2" />
      <path d="m9 11 3 3" />
      <path d="m12 8-3 3a2 2 0 0 0 2.8 2.8L14 11" />
    </svg>
  )
}

function parseProjectBrief(content: string | null, fallbackLanguage: BriefLang): ProjectBriefContent {
  if (!content) return { ...defaultProjectBrief, language: fallbackLanguage }
  try {
    const parsed = JSON.parse(content) as Partial<ProjectBriefContent>
    const language = parsed.language === 'en' || parsed.language === 'zh' ? parsed.language : fallbackLanguage
    return {
      ...defaultProjectBrief,
      ...parsed,
      language,
      stakeholders:
        parsed.stakeholders && parsed.stakeholders.length > 0
          ? parsed.stakeholders
          : defaultProjectBrief.stakeholders,
    }
  } catch {
    return { ...defaultProjectBrief, language: fallbackLanguage, problemStatement: content }
  }
}

function buildWordHtml(content: ProjectBriefContent, copy: (typeof briefCopy)[BriefLang], createdAt: string) {
  const rows = [
    [copy.fields.projectName, content.projectName],
    [copy.fields.owner, content.owner],
    [copy.fields.status, copy.status[content.status]],
    [copy.fields.startDate, content.startDate],
    [copy.fields.targetDate, content.targetDate],
    [copy.fields.team, content.team],
  ]
    .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
    .join('')

  const stakeholderRows = content.stakeholders
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.role)}</td><td>${escapeHtml(item.involvement)}</td></tr>`
    )
    .join('')

  return `<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a1a; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .meta { font-size: 12px; color: #888; margin-bottom: 24px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
  td, th { border: 1px solid #e5e5e5; padding: 8px 12px; font-size: 13px; text-align: left; }
  td:first-child { font-weight: bold; width: 200px; }
  h2 { font-size: 16px; margin-top: 28px; margin-bottom: 8px; }
  h3 { font-size: 13px; margin-top: 16px; margin-bottom: 4px; color: #555; }
  p { font-size: 13px; line-height: 1.8; white-space: pre-wrap; }
</style></head><body>
  <h1>${escapeHtml(content.title)}</h1>
  <div class="meta">${escapeHtml(copy.meta(formatDate(createdAt), formatDate(content.updatedAt ?? createdAt)))}</div>
  <table>${rows}</table>
  <h2>${escapeHtml(copy.sections.problemStatement)}</h2><p>${escapeHtml(content.problemStatement)}</p>
  <h2>${escapeHtml(copy.sections.goalsMetrics)}</h2>
  <h3>${escapeHtml(copy.labels.goals)}</h3><p>${escapeHtml(content.goals)}</p>
  <h3>${escapeHtml(copy.labels.successMetrics)}</h3><p>${escapeHtml(content.successMetrics)}</p>
  <h2>${escapeHtml(copy.sections.scope)}</h2>
  <h3>${escapeHtml(copy.labels.inScope)}</h3><p>${escapeHtml(content.inScope)}</p>
  <h3>${escapeHtml(copy.labels.outOfScope)}</h3><p>${escapeHtml(content.outOfScope)}</p>
  <h2>${escapeHtml(copy.sections.stakeholders)}</h2>
  <table><tr>${copy.stakeholderColumns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>${stakeholderRows}</table>
  <h2>${escapeHtml(copy.sections.risksDependencies)}</h2>
  <h3>${escapeHtml(copy.labels.risks)}</h3><p>${escapeHtml(content.risks)}</p>
  <h3>${escapeHtml(copy.labels.dependencies)}</h3><p>${escapeHtml(content.dependencies)}</p>
  <h2>${escapeHtml(copy.sections.openQuestions)}</h2><p>${escapeHtml(content.openQuestions)}</p>
</body></html>`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function sanitizeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').toLowerCase() || 'project'
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-HK')
}

function BriefInfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr>
      <th>{label}</th>
      <td>{children}</td>
    </tr>
  )
}

function BriefSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="brief-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function BriefSubsection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="brief-subsection">
      <h3>{label}</h3>
      {children}
    </div>
  )
}

function AutoTextarea({
  value,
  placeholder,
  onChange,
}: {
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  function handleInput(event: ChangeEvent<HTMLTextAreaElement>) {
    const textarea = event.currentTarget
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
    onChange(textarea.value)
  }

  return <textarea className="brief-textarea" value={value} placeholder={placeholder} onChange={handleInput} rows={2} />
}
