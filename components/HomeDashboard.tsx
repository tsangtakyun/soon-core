'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import PageHeader from '@/components/PageHeader'
import { CategoryTag, PipelineProgress, StatusBadge } from '@/components/StatusBadge'
import { getPipelinePath, getProjectPipeline } from '@/lib/pipelines'
import { supabase } from '@/lib/supabase'
import type { Project, Workspace } from '@/lib/types'

export function HomeDashboard() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [displayName, setDisplayName] = useState('User')
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const [{ data: projectData }, { data: workspaceData }, { data: authData }] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('workspaces').select('*').order('created_at', { ascending: false }),
      supabase.auth.getUser(),
    ])

    setProjects((projectData ?? []) as Project[])
    setWorkspaces((workspaceData ?? []) as Workspace[])

    const user = authData?.user
    const name =
      user?.user_metadata?.display_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split('@')[0] ||
      'User'
    setDisplayName(name)
  }

  async function openProject(project: Project) {
    window.localStorage.setItem('current_project_id', project.id)
    await supabase
      .from('projects')
      .update({ last_visited_at: new Date().toISOString() })
      .eq('id', project.id)

    const pipeline = getProjectPipeline(project.type, project.category)
    router.push(getPipelinePath(pipeline, project.pipeline_step))
  }

  const recent = [...projects]
    .sort((a, b) => Date.parse(b.last_visited_at ?? b.created_at) - Date.parse(a.last_visited_at ?? a.created_at))
    .slice(0, 4)

  const inProgress = projects
    .filter((project) => project.status !== '7. 已出片')
    .sort((a, b) => (a.shoot_date ?? '9999-12-31').localeCompare(b.shoot_date ?? '9999-12-31'))

  const workspaceCounts = useMemo(() => {
    return workspaces.map((workspace) => ({
      ...workspace,
      count: projects.filter((project) => project.workspace_id === workspace.id).length,
    }))
  }, [projects, workspaces])

  const todayTodos = projects.filter((project) => project.shoot_date === today)
  const greeting = getGreeting()

  return (
    <DashboardShell activeSection="home">
      <PageHeader icon="🏠" title="首頁" subtitle="快速存取你最近嘅項目同工作區域" />
      <div className="home-grid">
        <section className="home-main">
          <div className="hero-block">
            <h1>{greeting}，{displayName}！</h1>
            <p>今日可以由最近項目開始，或者直接進入工作區。</p>
          </div>

          <section className="dashboard-section">
            <div className="section-heading">
              <h2>最近項目</h2>
            </div>
            <div className="project-card-grid">
              {recent.map((project) => (
                <button key={project.id} className="project-card" type="button" onClick={() => void openProject(project)}>
                  <div className="card-title">{project.title}</div>
                  <StatusBadge status={project.status} />
                  <PipelineProgress step={project.pipeline_step} />
                  <CategoryTag category={project.category} />
                </button>
              ))}
              {recent.length === 0 && <div className="empty-card">未有最近項目</div>}
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-heading">
              <h2>進行中</h2>
            </div>
            <div className="compact-list">
              {inProgress.map((project) => (
                <button key={project.id} type="button" onClick={() => void openProject(project)}>
                  <span>{project.title}</span>
                  <StatusBadge status={project.status} />
                  <em>{project.shoot_date ?? '未定日期'}</em>
                </button>
              ))}
              {inProgress.length === 0 && <div className="empty-card">暫時無進行中項目</div>}
            </div>
          </section>
        </section>

        <aside className="home-side">
          <section className="side-card">
            <h2>工作區概覽</h2>
            {workspaceCounts.map((workspace) => (
              <div key={workspace.id} className="side-row">
                <span>{workspace.name}</span>
                <strong>{workspace.count}</strong>
              </div>
            ))}
            {workspaceCounts.length === 0 && <p className="muted">未有工作區</p>}
          </section>

          <section className="side-card">
            <h2>今日待辦</h2>
            {todayTodos.map((project) => (
              <div key={project.id} className="todo-item">
                <span>{project.title}</span>
                <em>{project.current_stage}</em>
              </div>
            ))}
            {todayTodos.length === 0 && <p className="muted">今日未有拍攝事項</p>}
          </section>
        </aside>
      </div>
    </DashboardShell>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return '早安'
  if (hour < 18) return '午安'
  return '晚上好'
}
