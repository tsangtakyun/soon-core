'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { getPipelinePath, pipelines, type PipelineConfig, type PipelineTool } from '@/lib/pipelines'
import { supabase } from '@/lib/supabase'
import type { Project, Workspace } from '@/lib/types'

type Section = 'home' | 'work' | 'docs' | 'pipeline'

interface DashboardShellProps {
  activeSection: Section
  pipeline?: PipelineConfig
  tool?: PipelineTool
  children?: React.ReactNode
}

const primaryNav = [
  { href: '/', label: '首頁', icon: '🏠', section: 'home' },
  { href: '/work', label: '我的工作', icon: '📅', section: 'work' },
  { href: '/docs', label: '文件中心', icon: '📄', section: 'docs' },
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

  useEffect(() => {
    if (pipeline?.id) setActivePipelineId(pipeline.id)
  }, [pipeline?.id])

  useEffect(() => {
    void loadSidebarData()
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
    const [{ data: workspaceData }, { data: projectData }] = await Promise.all([
      supabase.from('workspaces').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
    ])

    setWorkspaces((workspaceData ?? []) as Workspace[])
    setProjects((projectData ?? []) as Project[])
  }

  async function createWorkspace() {
    const name = window.prompt('新工作區名稱')
    if (!name?.trim()) return

    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name: name.trim(), type: pipeline?.id ?? 'youtube' })
      .select()
      .single()

    if (error) {
      window.alert(error.message)
      return
    }

    await loadSidebarData()
    router.push(`/work?workspace=${data.id}`)
  }

  const projectCounts = useMemo(() => {
    return projects.reduce<Record<string, number>>((counts, project) => {
      if (project.workspace_id) counts[project.workspace_id] = (counts[project.workspace_id] ?? 0) + 1
      return counts
    }, {})
  }, [projects])

  const iframeTitle = pipeline && tool ? `${pipeline.label} ${tool.label}` : ''

  return (
    <div className="core-shell">
      <aside className="core-sidebar">
        <div className="core-logo">⚡ SOON CORE</div>

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

        <PipelineToggle activeId={activePipelineId} onChange={setActivePipelineId} />
        <ToolNav pipeline={pipelines[activePipelineId]} activePath={pathname} />

        <div className="core-divider" />

        <section className="workspace-block">
          <div className="sidebar-section-title">工作區</div>
          <div className="workspace-list">
            {workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/work?workspace=${workspace.id}`}
                className={workspace.id === activeWorkspace ? 'active' : ''}
              >
                <span>{workspace.type === 'ig' ? 'IG' : 'YT'}</span>
                <strong>{workspace.name}</strong>
                <em>{projectCounts[workspace.id] ?? 0}</em>
              </Link>
            ))}
            {workspaces.length === 0 && <p className="empty-mini">未有工作區</p>}
          </div>
          <button className="ghost-button" type="button" onClick={() => void createWorkspace()}>
            + 新增工作區
          </button>
        </section>

        <div className="sidebar-user">
          <div className="avatar">T</div>
          <div>
            <strong>Tommy</strong>
            <span>SOON Studio</span>
          </div>
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
              src={tool.url}
              title={iframeTitle}
              referrerPolicy="no-referrer-when-downgrade"
              allow="camera; microphone; clipboard-read; clipboard-write; fullscreen"
            />
          </>
        ) : (
          <div className="dashboard-content">{children}</div>
        )}
      </main>
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
