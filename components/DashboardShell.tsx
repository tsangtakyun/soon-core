'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useWorkspace } from '@/app/context/workspace-context'
import { getPipelinePath, pipelines, type PipelineConfig, type PipelineTool } from '@/lib/pipelines'
import { supabase } from '@/lib/supabase'
import type { Project, Workspace, WorkspaceType } from '@/lib/types'
import { workspaceTypeOptions } from '@/lib/types'

type Section = 'home' | 'work' | 'docs' | 'schedule' | 'finance' | 'reply' | 'settings' | 'pipeline'

interface DashboardShellProps {
  activeSection: Section
  pipeline?: PipelineConfig
  tool?: PipelineTool
  children?: React.ReactNode
}

type WorkspaceDraft = {
  name: string
  type: WorkspaceType
  owner: string
  description: string
}

type SettingsProfile = {
  companyName: string
  displayName: string
  logoBase64: string
}

type AuthProfile = {
  id: string
  email: string
  name: string
  avatarUrl: string
}

type ScriptPickerDoc = {
  id: string
  title: string
  template_type: string
  content: string
  created_at?: string
  updated_at?: string
}

const primaryNav = [
  { href: '/', label: '首頁', icon: '🏠', section: 'home' },
  { href: '/work', label: '我的工作', icon: '📅', section: 'work' },
  { href: '/docs', label: '文件中心', icon: '📄', section: 'docs' },
  { href: '/schedule', label: '行程中心', icon: '📅', section: 'schedule' },
  { href: '/finance', label: '財務中心', icon: '💰', section: 'finance' },
  { href: '/reply', label: '回覆中心', icon: '💬', section: 'reply' },
] as const

const SIDEBAR_WORKSPACES_CACHE_KEY = 'soon_sidebar_workspaces'

function readCachedWorkspaces(): Workspace[] {
  if (typeof window === 'undefined') return []
  try {
    const cached = window.localStorage.getItem(SIDEBAR_WORKSPACES_CACHE_KEY)
    const parsed = cached ? JSON.parse(cached) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function DashboardShell({ activeSection, pipeline, tool, children }: DashboardShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlWorkspace = searchParams.get('workspace')
  const { activeWorkspaceId, setActiveWorkspace } = useWorkspace()
  const [activePipelineId, setActivePipelineId] = useState<PipelineConfig['id']>(pipeline?.id ?? 'youtube')
  const [workspaces, setWorkspaces] = useState<Workspace[]>(readCachedWorkspaces)
  const [sidebarDataLoaded, setSidebarDataLoaded] = useState(() => readCachedWorkspaces().length > 0)
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [workspacePanel, setWorkspacePanel] = useState<Workspace | null>(null)
  const [workspaceEditMode, setWorkspaceEditMode] = useState(false)
  const [workspaceDraft, setWorkspaceDraft] = useState<WorkspaceDraft>({
    name: '',
    type: 'youtube',
    owner: '',
    description: '',
  })
  const [settingsProfile, setSettingsProfile] = useState<SettingsProfile>({
    companyName: 'SOON Studio',
    displayName: 'Tommy',
    logoBase64: '',
  })
  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null)
  const [coreLogoFailed, setCoreLogoFailed] = useState(false)
  const [toolIframeSrc, setToolIframeSrc] = useState(tool?.url ?? '')
  const [scriptPickerOpen, setScriptPickerOpen] = useState(false)
  const [scriptPickerDocs, setScriptPickerDocs] = useState<ScriptPickerDoc[]>([])
  const [scriptPickerLoading, setScriptPickerLoading] = useState(false)
  const [scriptPickerError, setScriptPickerError] = useState('')
  const toolIframeRef = useRef<HTMLIFrameElement | null>(null)

  function makeClientId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return Math.random().toString(36).slice(2)
  }

  function parseQCToIGScript(text: string, topic: string, brand: string, industry = '', location = '') {
    const now = new Date().toISOString()
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
    const segments: any[] = []
    let currentSegment: any = null
    let currentBlocks: any[] = []

    const inferSegment = (title: string) => {
      if (title.includes('Hook') || title.includes('開場')) return { type: 'hook', suggestedTime: '5秒' }
      if (title.includes('背景') || title.includes('VO') || title.includes('旁白')) return { type: 'background', suggestedTime: '15秒' }
      if (title.includes('轉場')) return { type: 'turning_point', suggestedTime: '5秒' }
      if (title.includes('實測')) return { type: 'real_test', suggestedTime: '30秒' }
      if (title.includes('Ending') || title.includes('結尾')) return { type: 'ending', suggestedTime: '10秒' }
      return { type: 'other', suggestedTime: '' }
    }

    const pushSegment = () => {
      if (currentSegment && currentBlocks.length > 0) {
        segments.push({ ...currentSegment, blocks: currentBlocks })
      }
      currentBlocks = []
    }

    const startSegment = (type: string, title: string, suggestedTime: string) => {
      pushSegment()
      currentSegment = { id: makeClientId(), type, title, suggestedTime }
    }

    const stripPrefix = (value: string, prefixes: string[]) => {
      for (const prefix of prefixes) {
        if (value.startsWith(prefix)) return value.slice(prefix.length).trim()
      }
      return value
    }

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const bracketTitle = trimmed.match(/^【(.+)】$/) || trimmed.match(/^\[(.+)\]$/)
      const numberedTitle = trimmed.match(/^(\d+)[.、]\s*(.+)$/)

      if (bracketTitle || numberedTitle) {
        const title = bracketTitle?.[1] || numberedTitle?.[2] || trimmed
        const { type, suggestedTime } = inferSegment(title)
        startSegment(type, title, suggestedTime)
        continue
      }

      if (!currentSegment) startSegment('other', '完整 QC 稿', '')

      if (trimmed.startsWith('拍攝：') || trimmed.startsWith('拍摄：')) {
        currentBlocks.push({
          id: makeClientId(),
          type: 'scene',
          speaker: '',
          content: stripPrefix(trimmed, ['拍攝：', '拍摄：']),
        })
      } else if (trimmed.startsWith('旁白：') || trimmed.startsWith('VO：')) {
        currentBlocks.push({
          id: makeClientId(),
          type: 'voiceover',
          speaker: 'VO',
          content: stripPrefix(trimmed, ['旁白：', 'VO：']),
        })
      } else if (trimmed.startsWith('主持：')) {
        currentBlocks.push({
          id: makeClientId(),
          type: 'dialogue',
          speaker: brand || '主持',
          content: stripPrefix(trimmed, ['主持：']),
        })
      } else {
        const numberedLine = /^\d+\./.test(trimmed)
        currentBlocks.push({
          id: makeClientId(),
          type: numberedLine ? 'scene' : 'dialogue',
          speaker: numberedLine ? '' : brand || '主持',
          content: trimmed,
        })
      }
    }

    pushSegment()

    if (segments.length === 0 && text.trim()) {
      segments.push({
        id: makeClientId(),
        type: 'other',
        title: '完整 QC 稿',
        suggestedTime: '',
        blocks: [{
          id: makeClientId(),
          type: 'dialogue',
          speaker: brand || '主持',
          content: text.trim(),
        }],
      })
    }

    return {
      language: 'zh-HK',
      title: topic || 'IG Script',
      releaseDate: '',
      creator: brand || '',
      guest: '',
      location: location || '',
      series: industry || '',
      format: 'IG Reel',
      coverImage: '',
      scriptTitle: topic || '',
      segments,
      createdAt: now,
      updatedAt: now,
    }
  }

  useEffect(() => {
    if (pipeline?.id) setActivePipelineId(pipeline.id)
  }, [pipeline?.id])

  useEffect(() => {
    void loadSidebarData()
  }, [activeWorkspaceId])

  useEffect(() => {
    if (workspaces.length === 0) return

    const urlSelectedWorkspace = urlWorkspace ? workspaces.find((workspace) => workspace.id === urlWorkspace) : null
    if (urlSelectedWorkspace && activeWorkspaceId !== urlSelectedWorkspace.id) {
      setActiveWorkspace(urlSelectedWorkspace.id, urlSelectedWorkspace.name)
      return
    }

    const activeStillExists = workspaces.some((workspace) => workspace.id === activeWorkspaceId)
    if (!activeWorkspaceId || !activeStillExists) {
      const firstWorkspace = workspaces[0]
      setActiveWorkspace(firstWorkspace.id, firstWorkspace.name)
    }
  }, [activeWorkspaceId, setActiveWorkspace, urlWorkspace, workspaces])

  useEffect(() => {
    const refreshSidebar = () => void loadSidebarData()
    window.addEventListener('soon-data-updated', refreshSidebar)
    return () => window.removeEventListener('soon-data-updated', refreshSidebar)
  }, [])

  useEffect(() => {
    const projectId = window.localStorage.getItem('current_project_id')
    if (!projectId) {
      setActiveProject(null)
      return
    }
    setActiveProject(projects.find((project) => project.id === projectId) ?? null)
  }, [projects])

  async function loadSidebarData() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      setAuthProfile({
        id: user.id,
        email: user.email ?? '',
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      })
      await fetch('/api/auth/bootstrap', { method: 'POST' }).catch(() => null)
    }

    const projectsUrl = activeWorkspaceId ? `/api/projects?workspace_id=${encodeURIComponent(activeWorkspaceId)}` : '/api/projects'
    const [projectsResponse, settingsResponse] = await Promise.all([
      fetch(projectsUrl, { cache: 'no-store' }),
      fetch('/api/settings', { cache: 'no-store' }),
    ])

    const projectsData = projectsResponse.ok ? await projectsResponse.json() : null
    const settingsData = settingsResponse.ok ? await settingsResponse.json() : null

    const nextWorkspaces = Array.isArray(projectsData?.workspaces) ? (projectsData.workspaces as Workspace[]) : null
    if (nextWorkspaces) {
      setWorkspaces(nextWorkspaces)
      window.localStorage.setItem(SIDEBAR_WORKSPACES_CACHE_KEY, JSON.stringify(nextWorkspaces))
    }
    setSidebarDataLoaded(true)
    setProjects((projectsData?.projects ?? []) as Project[])
    setSettingsProfile({
      companyName: settingsData?.company_name || 'SOON Studio',
      displayName: settingsData?.display_name || 'Tommy',
      logoBase64: settingsData?.logo_base64 || '',
    })
  }

  function notifyWorkspaceChange() {
    window.dispatchEvent(new Event('soon-workspaces-changed'))
  }

  async function createWorkspace() {
    const name = window.prompt('新增工作區名稱')
    if (!name?.trim()) return

    const response = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        type: pipeline?.id ?? activePipelineId,
      }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data?.workspace?.id) {
      window.alert(data?.error || '新增工作區失敗，請重試。')
      return
    }

    await loadSidebarData()
    setActiveWorkspace(data.workspace.id, data.workspace.name)
    notifyWorkspaceChange()
    router.push(`/work?workspace=${data.workspace.id}`)
  }

  function openWorkspacePanel(workspace: Workspace) {
    setWorkspacePanel(workspace)
    setWorkspaceEditMode(false)
    setWorkspaceDraft({
      name: workspace.name,
      type: workspace.type ?? 'youtube',
      owner: workspace.owner ?? '',
      description: workspace.description ?? '',
    })
  }

  async function saveWorkspace() {
    if (!workspacePanel) return
    if (!workspaceDraft.name.trim()) {
      window.alert('請輸入工作區名稱')
      return
    }

    const response = await fetch('/api/workspaces', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: workspacePanel.id,
        name: workspaceDraft.name.trim(),
        type: workspaceDraft.type,
        owner: workspaceDraft.owner.trim() || null,
        description: workspaceDraft.description.trim() || null,
      }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data?.workspace) {
      window.alert(data?.error || '儲存工作區失敗，請重試。')
      return
    }

    setWorkspacePanel(data.workspace as Workspace)
    setWorkspaceEditMode(false)
    await loadSidebarData()
    notifyWorkspaceChange()
  }

  async function deleteWorkspace() {
    if (!workspacePanel) return
    const confirmed = window.confirm(`確認刪除工作區「${workspacePanel.name}」？相關項目都會一併刪除。`)
    if (!confirmed) return

    const response = await fetch('/api/workspaces', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: workspacePanel.id }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      window.alert(data?.error || '刪除工作區失敗，請重試。')
      return
    }

    const deletedActiveWorkspace = workspacePanel.id === activeWorkspaceId
    setWorkspacePanel(null)
    await loadSidebarData()
    notifyWorkspaceChange()
    if (deletedActiveWorkspace) router.push('/work')
  }

  const projectCounts = useMemo(() => {
    return projects.reduce<Record<string, number>>((counts, project) => {
      if (project.workspace_id) counts[project.workspace_id] = (counts[project.workspace_id] ?? 0) + 1
      return counts
    }, {})
  }, [projects])

  const iframeTitle = pipeline && tool ? `${pipeline.label} ${tool.label}` : ''
  const selectedWorkspaceCount = workspacePanel ? projectCounts[workspacePanel.id] ?? 0 : 0
  const sidebarName = authProfile?.name || settingsProfile.displayName
  const sidebarEmail = authProfile?.email || settingsProfile.companyName
  const sidebarAvatar = settingsProfile.logoBase64 || authProfile?.avatarUrl
  const toolTopic = searchParams.get('topic') || ''
  const toolBackground = searchParams.get('background') || ''
  const toolLocation = searchParams.get('location') || ''
  const toolScript = searchParams.get('script') || ''
  const toolScriptId = searchParams.get('scriptId') || ''

  function safeDecodeParam(value: string) {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  function buildToolUrlWithPrefill(baseUrl: string) {
    const url = new URL(baseUrl)
    if (pipeline?.id === 'youtube' && tool?.id === 'storyboard') {
      url.pathname = '/'
    }
    if (toolTopic) url.searchParams.set('topic', safeDecodeParam(toolTopic))
    if (toolBackground) url.searchParams.set('background', safeDecodeParam(toolBackground))
    if (toolLocation) url.searchParams.set('location', safeDecodeParam(toolLocation))
    if (toolScript) url.searchParams.set('script', safeDecodeParam(toolScript))
    if (toolScriptId) url.searchParams.set('scriptId', toolScriptId)
    return url.toString()
  }

  async function sendAuthToToolIframe() {
    if (!tool || !toolIframeRef.current?.contentWindow) return

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token || !session.refresh_token) return

    const targetOrigin = new URL(tool.url).origin
    toolIframeRef.current.contentWindow.postMessage(
      {
        type: 'SOON_AUTH',
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        token: session.access_token,
        userId: session.user.id,
        workspaceId: activeWorkspaceId,
      },
      targetOrigin
    )
  }

  function extractScriptForStoryboard(doc: ScriptPickerDoc) {
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
          const title = segment?.title || segment?.type || `Segment ${index + 1}`
          const time = segment?.suggestedTime ? ` (${segment.suggestedTime})` : ''
          const blocks = Array.isArray(segment?.blocks) ? segment.blocks : []
          const blockText = blocks
            .map((block: any) => {
              const type = String(block?.type || '').toLowerCase()
              const content = String(block?.content || '').trim()
              if (!content) return ''
              if (type.includes('scene') || type.includes('shot')) return `Scene: ${content}`
              if (type.includes('voice') || type.includes('vo')) return `VO: ${content}`
              const speaker = block?.speaker || parsed.creator || 'Host'
              return `${speaker}: ${content}`
            })
            .filter(Boolean)
            .join('\n')

          return `${index + 1}. ${title}${time}${blockText ? `\n${blockText}` : ''}`
        })
        .join('\n\n')
    }

    return rawContent
  }

  async function openScriptPicker() {
    setScriptPickerOpen(true)
    setScriptPickerLoading(true)
    setScriptPickerError('')

    try {
      const query = activeWorkspaceId ? `?workspace_id=${encodeURIComponent(activeWorkspaceId)}` : ''
      const response = await fetch(`/api/docs${query}`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load documents')
      }

      const docs = Array.isArray(data?.docs) ? data.docs : []
      setScriptPickerDocs(docs.filter((doc: ScriptPickerDoc) => doc.template_type === 'ig_script'))
    } catch {
      setScriptPickerDocs([])
      setScriptPickerError('未能載入文件，請重試。')
    } finally {
      setScriptPickerLoading(false)
    }
  }

  function selectScriptForStoryboard(doc: ScriptPickerDoc) {
    if (!toolIframeRef.current?.contentWindow) return

    const message = {
      type: 'SOON_SCRIPT_SELECTED',
      script: extractScriptForStoryboard(doc),
      topic: doc.title,
    }

    const targetOrigin = tool ? new URL(tool.url).origin : '*'
    toolIframeRef.current.contentWindow.postMessage(message, targetOrigin)
    setScriptPickerOpen(false)
  }

  useEffect(() => {
    if (activeWorkspaceId) void sendAuthToToolIframe()
  }, [activeWorkspaceId])

  async function buildAuthenticatedToolUrl() {
    if (!tool) return ''
    const toolUrl = buildToolUrlWithPrefill(tool.url)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token || !session.refresh_token) return toolUrl

    const authPayload = {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      userId: session.user.id,
      workspaceId: activeWorkspaceId,
    }
    const encoded = encodeURIComponent(window.btoa(JSON.stringify(authPayload)))
    return `${toolUrl}#soon_auth=${encoded}`
  }

  useEffect(() => {
    if (!tool) return
    void buildAuthenticatedToolUrl().then(setToolIframeSrc)
    const timers = [800, 1800, 3200].map((delay) => window.setTimeout(() => {
      void sendAuthToToolIframe()
    }, delay))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [tool?.url, activeWorkspaceId, toolTopic, toolBackground, toolLocation, toolScript, toolScriptId])

  useEffect(() => {
    const handleNavigateTool = (event: MessageEvent) => {
      if (event.data?.type !== 'SOON_NAVIGATE_TOOL') return
      const { pipeline: nextPipeline, tool: nextTool, topic, background, location, script, scriptId } = event.data
      if (!nextPipeline || !nextTool) return

      const params = new URLSearchParams()
      if (topic) params.set('topic', encodeURIComponent(String(topic)))
      if (background) params.set('background', encodeURIComponent(String(background)))
      if (location) params.set('location', encodeURIComponent(String(location)))
      if (script) params.set('script', encodeURIComponent(String(script)))
      if (scriptId) params.set('scriptId', String(scriptId))
      const query = params.toString()
      router.push(`/${nextPipeline}/${nextTool}${query ? `?${query}` : ''}`)
    }

    const handleRequestScript = (event: MessageEvent) => {
      if (event.data?.type !== 'SOON_REQUEST_SCRIPT') return
      void openScriptPicker()
    }

    const handleCreateDoc = async (event: MessageEvent) => {
      if (event.data?.type !== 'SOON_CREATE_DOC') return

      const { qc_final: qcFinal, topic, brand, industry, location, workspace_id: messageWorkspaceId } = event.data
      if (!qcFinal) return

      const igScriptContent = parseQCToIGScript(String(qcFinal), String(topic || ''), String(brand || ''), String(industry || ''), String(location || ''))

      try {
        const response = await fetch('/api/docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: topic || 'IG Script',
            template_type: 'ig_script',
            workspace_id: messageWorkspaceId || activeWorkspaceId || null,
            content: JSON.stringify(igScriptContent),
          }),
        })
        const data = await response.json().catch(() => ({}))

        if (data?.doc?.id) {
          router.push(`/docs?open=${encodeURIComponent(data.doc.id)}`)
        } else {
          router.push('/docs')
        }
      } catch {
        router.push('/docs')
      }
    }

    const handleToolReady = (event: MessageEvent) => {
      if (event.data?.type !== 'SOON_TOOL_READY') return
      if (event.source !== toolIframeRef.current?.contentWindow) return
      void sendAuthToToolIframe()
    }

    window.addEventListener('message', handleNavigateTool)
    window.addEventListener('message', handleRequestScript)
    window.addEventListener('message', handleCreateDoc)
    window.addEventListener('message', handleToolReady)
    return () => {
      window.removeEventListener('message', handleNavigateTool)
      window.removeEventListener('message', handleRequestScript)
      window.removeEventListener('message', handleCreateDoc)
      window.removeEventListener('message', handleToolReady)
    }
  }, [tool?.url, activeWorkspaceId, router])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="core-shell">
      <aside className="core-sidebar soon-no-print">
        <div className="core-logo">
          {coreLogoFailed ? (
            <span>SOON CORE</span>
          ) : (
            <img
              src="/soon_core_logo.png"
              alt=""
              style={{ height: '28px', objectFit: 'contain' }}
              onError={(event) => {
                event.currentTarget.style.display = 'none'
                setCoreLogoFailed(true)
              }}
            />
          )}
        </div>

        <nav className="core-nav" aria-label="Main navigation">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={activeSection === item.section ? 'active' : ''}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="core-divider" />

        <span className="sidebar-start-label">開始創作</span>
        <PipelineToggle activeId={activePipelineId} onChange={setActivePipelineId} />
        <ToolNav pipeline={pipelines[activePipelineId]} activePath={pathname} />

        <div className="core-divider" />

        <section className="workspace-block">
          <div className="sidebar-section-title">工作區</div>
          <div className="workspace-list">
            {workspaces.map((workspace) => (
              <div key={workspace.id} className={`workspace-item ${workspace.id === activeWorkspaceId ? 'active' : ''}`}>
                <Link
                  href={`/work?workspace=${workspace.id}`}
                  className="workspace-link"
                  onClick={() => setActiveWorkspace(workspace.id, workspace.name)}
                >
                  <span>{workspace.type === 'ig' ? 'IG' : workspace.type === 'mixed' ? 'MX' : 'YT'}</span>
                  <strong>{workspace.name}</strong>
                  <em>{projectCounts[workspace.id] ?? 0}</em>
                </Link>
                <button
                  className="workspace-menu-button"
                  type="button"
                  aria-label={`開啟 ${workspace.name} 工作區資料`}
                  onClick={() => openWorkspacePanel(workspace)}
                >
                  ⋯
                </button>
              </div>
            ))}
            {sidebarDataLoaded && workspaces.length === 0 && <p className="empty-mini">未有工作區</p>}
          </div>
          <button className="ghost-button" type="button" onClick={() => void createWorkspace()}>
            + 新增工作區
          </button>
        </section>

        <Link href="/settings" className={`sidebar-settings-link ${activeSection === 'settings' ? 'active' : ''}`}>
          <span>⚙️</span>
          <span>設定</span>
        </Link>

        <div className="sidebar-user">
          {sidebarAvatar ? (
            <img className="sidebar-logo-avatar" src={sidebarAvatar} alt="" />
          ) : (
            <div className="avatar">{sidebarName.slice(0, 1).toUpperCase()}</div>
          )}
          <div>
            <strong>{sidebarName}</strong>
            <span>{sidebarEmail}</span>
          </div>
          <button className="sidebar-signout" type="button" onClick={() => void signOut()}>
            登出
          </button>
        </div>
      </aside>

      <main className="core-main">
        {pipeline && tool ? (
          <>
            <header className="iframe-topbar">
              <div>
                <h1>{tool.label}</h1>
                {activeProject && (
                  <div className="active-project-banner">
                    📽 {activeProject.title} — {activeProject.pipeline_step}
                  </div>
                )}
              </div>
              <span className={`pipeline-badge ${pipeline.id}`}>{pipeline.badge}</span>
            </header>
            <iframe
              key={toolIframeSrc || tool.url}
              ref={toolIframeRef}
              src={toolIframeSrc || tool.url}
              title={iframeTitle}
              referrerPolicy="no-referrer-when-downgrade"
              allow="camera; microphone; clipboard-read; clipboard-write; fullscreen"
              onLoad={() => void sendAuthToToolIframe()}
            />
          </>
        ) : (
          <div className="dashboard-content">{children}</div>
        )}
      </main>

      {workspacePanel && (
        <aside className="workspace-info-panel">
          <div className="panel-head">
            <h2>{workspacePanel.name}</h2>
            <div className="panel-head-actions">
              <button type="button" onClick={() => setWorkspaceEditMode((current) => !current)}>
                {workspaceEditMode ? '取消' : '編輯'}
              </button>
              <button type="button" onClick={() => setWorkspacePanel(null)}>
                關閉
              </button>
            </div>
          </div>

          <label>
            名稱
            <input
              value={workspaceDraft.name}
              disabled={!workspaceEditMode}
              onChange={(event) => setWorkspaceDraft({ ...workspaceDraft, name: event.target.value })}
            />
          </label>
          <label>
            類型
            <select
              value={workspaceDraft.type}
              disabled={!workspaceEditMode}
              onChange={(event) => setWorkspaceDraft({ ...workspaceDraft, type: event.target.value as WorkspaceType })}
            >
              {workspaceTypeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            負責人
            <input
              value={workspaceDraft.owner}
              disabled={!workspaceEditMode}
              onChange={(event) => setWorkspaceDraft({ ...workspaceDraft, owner: event.target.value })}
            />
          </label>
          <label>
            描述
            <textarea
              rows={3}
              value={workspaceDraft.description}
              disabled={!workspaceEditMode}
              onChange={(event) => setWorkspaceDraft({ ...workspaceDraft, description: event.target.value })}
            />
          </label>
          <div className="readonly-field">
            <span>建立日期</span>
            <strong>{new Date(workspacePanel.created_at).toLocaleDateString('zh-HK')}</strong>
          </div>
          <div className="readonly-field">
            <span>項目數量</span>
            <strong>{selectedWorkspaceCount}</strong>
          </div>

          {workspaceEditMode && (
            <button className="primary-button" type="button" onClick={() => void saveWorkspace()}>
              儲存
            </button>
          )}

          <button className="danger-button" type="button" onClick={() => void deleteWorkspace()}>
            刪除工作區
          </button>
        </aside>
      )}

      {scriptPickerOpen && (
        <div
          role="presentation"
          onClick={() => setScriptPickerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.62)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="選擇劇本文件"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(560px, 100%)',
              maxHeight: '72vh',
              overflow: 'hidden',
              background: 'var(--soon-surface)',
              border: '0.5px solid var(--soon-border)',
              borderRadius: 'var(--soon-radius-lg)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
              color: 'var(--soon-text)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '18px 20px',
                borderBottom: '0.5px solid var(--soon-border)',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>選擇劇本文件</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--soon-text-secondary)' }}>
                  從文件中心揀一份 IG Script，會自動填入分鏡工作台。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScriptPickerOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--soon-text-secondary)',
                  cursor: 'pointer',
                  fontSize: 22,
                  lineHeight: 1,
                  padding: 4,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 20, maxHeight: 'calc(72vh - 92px)', overflowY: 'auto' }}>
              {scriptPickerLoading && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--soon-text-secondary)' }}>載入文件中...</p>
              )}

              {!scriptPickerLoading && scriptPickerError && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--soon-warning)' }}>{scriptPickerError}</p>
              )}

              {!scriptPickerLoading && !scriptPickerError && scriptPickerDocs.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--soon-text-secondary)' }}>
                  暫時未有 IG Script 文件。
                </p>
              )}

              {!scriptPickerLoading && !scriptPickerError && scriptPickerDocs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => selectScriptForStoryboard(doc)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                    padding: '12px 14px',
                    marginBottom: 10,
                    background: 'var(--soon-surface2)',
                    border: '0.5px solid var(--soon-border)',
                    borderRadius: 'var(--soon-radius)',
                    color: 'var(--soon-text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>
                    <strong style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{doc.title || '未命名劇本'}</strong>
                    <small style={{ display: 'block', marginTop: 4, color: 'var(--soon-text-secondary)', fontSize: 11 }}>
                      {doc.updated_at ? `最近更新 ${new Date(doc.updated_at).toLocaleDateString('zh-HK')}` : 'IG Script'}
                    </small>
                  </span>
                  <span style={{ color: 'var(--soon-purple-light)', fontSize: 12, flexShrink: 0 }}>選取</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PipelineToggle({
  activeId,
  onChange,
}: {
  activeId: PipelineConfig['id']
  onChange: (id: PipelineConfig['id']) => void
}) {
  return (
    <div className="pipeline-toggle" aria-label="Pipeline selector">
      {Object.values(pipelines).map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === activeId ? 'active' : ''}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function ToolNav({ pipeline, activePath }: { pipeline: PipelineConfig; activePath: string }) {
  return (
    <nav className="tool-nav compact" aria-label={`${pipeline.label} tools`}>
      {pipeline.tools.map((item) => {
        const href = getPipelinePath(pipeline.id, item.id)
        return (
          <Link key={`${pipeline.id}-${item.id}`} href={href} className={activePath === href ? 'active' : ''}>
            <span className="tool-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
