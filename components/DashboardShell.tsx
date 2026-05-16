'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

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

const primaryNav = [
  { href: '/', label: '首頁', icon: '🏠', section: 'home' },
  { href: '/work', label: '我的工作', icon: '📅', section: 'work' },
  { href: '/docs', label: '文件中心', icon: '📄', section: 'docs' },
  { href: '/schedule', label: '行程中心', icon: '📅', section: 'schedule' },
  { href: '/finance', label: '財務中心', icon: '💰', section: 'finance' },
  { href: '/reply', label: '回覆中心', icon: '💬', section: 'reply' },
] as const

export function DashboardShell({ activeSection, pipeline, tool, children }: DashboardShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeWorkspace = searchParams.get('workspace')
  const [activePipelineId, setActivePipelineId] = useState<PipelineConfig['id']>(pipeline?.id ?? 'youtube')
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
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
  const toolIframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    if (pipeline?.id) setActivePipelineId(pipeline.id)
  }, [pipeline?.id])

  useEffect(() => {
    void loadSidebarData()
  }, [])

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

    const [{ data: workspaceData }, { data: projectData }, settingsResponse] = await Promise.all([
      supabase.from('workspaces').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      fetch('/api/settings', { cache: 'no-store' }),
    ])

    const settingsData = settingsResponse.ok ? await settingsResponse.json() : null

    setWorkspaces((workspaceData ?? []) as Workspace[])
    setProjects((projectData ?? []) as Project[])
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
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name: name.trim(), type: pipeline?.id ?? activePipelineId, owner_id: user?.id ?? null })
      .select()
      .single()

    if (error) {
      window.alert(error.message)
      return
    }

    if (user) {
      await supabase.from('workspace_members').upsert(
        {
          workspace_id: data.id,
          user_id: user.id,
          email: user.email ?? '',
          display_name: user.user_metadata?.full_name || user.user_metadata?.name || settingsProfile.displayName,
          role: 'owner',
          status: 'active',
          invited_by: user.id,
        },
        { onConflict: 'workspace_id,user_id' }
      )
    }

    await loadSidebarData()
    notifyWorkspaceChange()
    router.push(`/work?workspace=${data.id}`)
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

    const { data, error } = await supabase
      .from('workspaces')
      .update({
        name: workspaceDraft.name.trim(),
        type: workspaceDraft.type,
        owner: workspaceDraft.owner.trim() || null,
        description: workspaceDraft.description.trim() || null,
      })
      .eq('id', workspacePanel.id)
      .select()
      .single()

    if (error) {
      window.alert(error.message)
      return
    }

    setWorkspacePanel(data as Workspace)
    setWorkspaceEditMode(false)
    await loadSidebarData()
    notifyWorkspaceChange()
  }

  async function deleteWorkspace() {
    if (!workspacePanel) return
    const confirmed = window.confirm(`確認刪除工作區「${workspacePanel.name}」？相關項目都會一併刪除。`)
    if (!confirmed) return

    const { error: projectError } = await supabase.from('projects').delete().eq('workspace_id', workspacePanel.id)
    if (projectError) {
      window.alert(projectError.message)
      return
    }

    const { error } = await supabase.from('workspaces').delete().eq('id', workspacePanel.id)
    if (error) {
      window.alert(error.message)
      return
    }

    const deletedActiveWorkspace = workspacePanel.id === activeWorkspace
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
  const activeWorkspaceId = activeWorkspace || workspaces[0]?.id || ''

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

  useEffect(() => {
    if (!tool) return
    const timers = [800, 1800, 3200].map((delay) => window.setTimeout(() => {
      void sendAuthToToolIframe()
    }, delay))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [tool?.url, activeWorkspaceId])

  useEffect(() => {
    const handleToolReady = (event: MessageEvent) => {
      if (event.data?.type !== 'SOON_TOOL_READY') return
      if (event.source !== toolIframeRef.current?.contentWindow) return
      void sendAuthToToolIframe()
    }

    window.addEventListener('message', handleToolReady)
    return () => window.removeEventListener('message', handleToolReady)
  }, [tool?.url, activeWorkspaceId])

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
              <div key={workspace.id} className={`workspace-item ${workspace.id === activeWorkspace ? 'active' : ''}`}>
                <Link href={`/work?workspace=${workspace.id}`} className="workspace-link">
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
            {workspaces.length === 0 && <p className="empty-mini">未有工作區</p>}
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
              key={tool.url}
              ref={toolIframeRef}
              src={tool.url}
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
