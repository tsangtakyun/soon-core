'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { KeyboardEvent, useEffect, useMemo, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import { AvatarChip, CategoryTag, PipelineProgress, StageBadge, StatusBadge } from '@/components/StatusBadge'
import { getPipelinePath, getProjectPipeline } from '@/lib/pipelines'
import { supabase } from '@/lib/supabase'
import {
  categoryOptions,
  stageOptions,
  statusOptions,
  type PipelineStep,
  type Project,
  type ProjectCategory,
  type ProjectStage,
  type ProjectStatus,
  type Workspace,
} from '@/lib/types'

const pipelineOptions: PipelineStep[] = ['idea', 'script', 'storyboard', 'production', 'subtitle', 'done']

type ProjectDraft = {
  title: string
  category: ProjectCategory
  host: string
  owner: string
  shoot_date: string
  status: ProjectStatus
  current_stage: ProjectStage
  workspace_id: string
  pipeline_step: PipelineStep
  output_url: string
}

const emptyProject: ProjectDraft = {
  title: '',
  category: 'youtube',
  host: '',
  owner: '',
  shoot_date: '',
  status: '1. 未拍攝',
  current_stage: '未寫稿',
  workspace_id: '',
  pipeline_step: 'idea',
  output_url: '',
}

export function WorkBoard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const workspaceFilter = searchParams.get('workspace')
  const [projects, setProjects] = useState<Project[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [draft, setDraft] = useState<ProjectDraft>(emptyProject)

  useEffect(() => {
    void load()
  }, [workspaceFilter])

  async function load() {
    const [{ data: projectData }, { data: workspaceData }] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('workspaces').select('*').order('created_at', { ascending: false }),
    ])
    setProjects((projectData ?? []) as Project[])
    setWorkspaces((workspaceData ?? []) as Workspace[])
  }

  const visibleProjects = useMemo(() => {
    return projects.filter((project) => {
      if (workspaceFilter && project.workspace_id !== workspaceFilter) return false
      if (statusFilter && project.status !== statusFilter) return false
      if (categoryFilter && project.category !== categoryFilter) return false
      if (ownerFilter && (project.owner ?? '') !== ownerFilter) return false
      if (query && !project.title.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [categoryFilter, ownerFilter, projects, query, statusFilter, workspaceFilter])

  const owners = Array.from(new Set(projects.map((project) => project.owner).filter(Boolean))) as string[]

  function openCreatePanel() {
    setSelectedProject(null)
    setDraft({ ...emptyProject, workspace_id: workspaceFilter ?? '' })
    setPanelMode('create')
  }

  function openEditPanel(project: Project) {
    setSelectedProject(project)
    setDraft({
      title: project.title,
      category: project.category,
      host: project.host ?? '',
      owner: project.owner ?? '',
      shoot_date: project.shoot_date ?? '',
      status: project.status,
      current_stage: project.current_stage,
      workspace_id: project.workspace_id ?? '',
      pipeline_step: project.pipeline_step,
      output_url: project.output_url ?? '',
    })
    setPanelMode('edit')
  }

  function closePanel() {
    setPanelMode(null)
    setSelectedProject(null)
  }

  async function saveProject() {
    if (!draft.title.trim()) {
      window.alert('請輸入題目')
      return
    }

    const category = categoryOptions.find((item) => item.value === draft.category) ?? categoryOptions[0]
    const payload = {
      title: draft.title.trim(),
      category: draft.category,
      type: category.type,
      host: draft.host.trim() || null,
      owner: draft.owner.trim() || null,
      shoot_date: draft.shoot_date || null,
      status: draft.status,
      current_stage: draft.current_stage,
      workspace_id: draft.workspace_id || null,
      pipeline_step: draft.pipeline_step,
      output_url: draft.output_url.trim() || null,
    }

    const request =
      panelMode === 'edit' && selectedProject
        ? supabase.from('projects').update(payload).eq('id', selectedProject.id)
        : supabase.from('projects').insert({ ...payload, languages: 3 })

    const { error } = await request
    if (error) {
      window.alert(error.message)
      return
    }

    closePanel()
    await load()
  }

  async function openPipeline(project: Project) {
    window.localStorage.setItem('current_project_id', project.id)
    await supabase
      .from('projects')
      .update({ last_visited_at: new Date().toISOString() })
      .eq('id', project.id)
    router.push(getPipelinePath(getProjectPipeline(project.type, project.category), project.pipeline_step))
  }

  function handleRowKey(event: KeyboardEvent<HTMLTableRowElement>, project: Project) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openEditPanel(project)
    }
  }

  return (
    <DashboardShell activeSection="work">
      <section className="board-page">
        <header className="board-toolbar">
          <div>
            <h1>我的工作</h1>
            <p>內容製作 pipeline board</p>
          </div>
          <button className="primary-button" type="button" onClick={openCreatePanel}>
            + 新項目
          </button>
        </header>

        <div className="filters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋題目" />
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">全部類別</option>
            {categoryOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">全部 Status</option>
            {statusOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
            <option value="">全部負責人</option>
            {owners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>

        <div className="work-table-wrap">
          <table className="work-table">
            <thead>
              <tr>
                <th>題目</th>
                <th>類別</th>
                <th>Status</th>
                <th>當前工序</th>
                <th>主持</th>
                <th>負責人</th>
                <th>拍攝日期</th>
                <th>Pipeline</th>
                <th>Output</th>
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((project) => (
                <tr
                  key={project.id}
                  tabIndex={0}
                  onClick={() => openEditPanel(project)}
                  onKeyDown={(event) => handleRowKey(event, project)}
                >
                  <td>
                    <button
                      className="row-title-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void openPipeline(project)
                      }}
                    >
                      {project.title}
                    </button>
                  </td>
                  <td>
                    <CategoryTag category={project.category} />
                  </td>
                  <td>
                    <StatusBadge status={project.status} />
                  </td>
                  <td>
                    <StageBadge stage={project.current_stage} />
                  </td>
                  <td>
                    <AvatarChip name={project.host} />
                  </td>
                  <td>
                    <AvatarChip name={project.owner} />
                  </td>
                  <td>
                    <span className="shoot-date">{project.shoot_date ?? '未定'}</span>
                  </td>
                  <td>
                    <button
                      className="pipeline-cell"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void openPipeline(project)
                      }}
                    >
                      <PipelineProgress step={project.pipeline_step} />
                      <span className="step-label">{project.pipeline_step}</span>
                    </button>
                  </td>
                  <td>
                    {project.output_url ? (
                      <a
                        className="output-link"
                        href={project.output_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        打開
                      </a>
                    ) : (
                      <span className="muted">未有</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {panelMode && (
        <aside className="slide-panel project-panel">
          <div className="panel-head">
            <h2>{panelMode === 'edit' ? draft.title || '編輯項目' : '新項目'}</h2>
            <button type="button" onClick={closePanel}>
              關閉
            </button>
          </div>
          <label>
            題目
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>
          <label>
            類別
            <select
              value={draft.category}
              onChange={(event) => setDraft({ ...draft, category: event.target.value as ProjectCategory })}
            >
              {categoryOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={draft.status}
              onChange={(event) => setDraft({ ...draft, status: event.target.value as ProjectStatus })}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            當前工序
            <select
              value={draft.current_stage}
              onChange={(event) => setDraft({ ...draft, current_stage: event.target.value as ProjectStage })}
            >
              {stageOptions.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
          <label>
            主持
            <input value={draft.host} onChange={(event) => setDraft({ ...draft, host: event.target.value })} />
          </label>
          <label>
            負責人
            <input value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} />
          </label>
          <label>
            拍攝日期
            <input
              type="date"
              value={draft.shoot_date}
              onChange={(event) => setDraft({ ...draft, shoot_date: event.target.value })}
            />
          </label>
          <label>
            Pipeline step
            <select
              value={draft.pipeline_step}
              onChange={(event) => setDraft({ ...draft, pipeline_step: event.target.value as PipelineStep })}
            >
              {pipelineOptions.map((step) => (
                <option key={step} value={step}>
                  {step}
                </option>
              ))}
            </select>
          </label>
          <label>
            Output URL
            <input
              value={draft.output_url}
              onChange={(event) => setDraft({ ...draft, output_url: event.target.value })}
              placeholder="https://"
            />
          </label>
          <label>
            Workspace
            <select
              value={draft.workspace_id}
              onChange={(event) => setDraft({ ...draft, workspace_id: event.target.value })}
            >
              <option value="">未分類</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
          <div className="panel-actions">
            <button className="primary-button" type="button" onClick={() => void saveProject()}>
              儲存項目
            </button>
          </div>
        </aside>
      )}
    </DashboardShell>
  )
}
