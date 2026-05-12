'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import { CategoryTag, PipelineProgress, StatusBadge } from '@/components/StatusBadge'
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

const emptyProject = {
  title: '',
  category: 'youtube' as ProjectCategory,
  host: '',
  owner: '',
  shoot_date: '',
  status: '1. 未拍攝' as ProjectStatus,
  current_stage: '未寫稿' as ProjectStage,
  workspace_id: '',
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
  const [panelOpen, setPanelOpen] = useState(false)
  const [draft, setDraft] = useState(emptyProject)

  useEffect(() => {
    void load()
  }, [])

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

  async function updateProject(id: string, patch: Partial<Project>) {
    setProjects((current) =>
      current.map((project) => (project.id === id ? { ...project, ...patch } : project))
    )
    const { error } = await supabase.from('projects').update(patch).eq('id', id)
    if (error) {
      window.alert(error.message)
      await load()
    }
  }

  async function createProject() {
    if (!draft.title.trim()) {
      window.alert('請輸入題目')
      return
    }

    const category = categoryOptions.find((item) => item.value === draft.category) ?? categoryOptions[0]
    const { error } = await supabase.from('projects').insert({
      ...draft,
      title: draft.title.trim(),
      type: category.type,
      workspace_id: draft.workspace_id || null,
      shoot_date: draft.shoot_date || null,
      pipeline_step: 'idea',
      languages: 3,
    })

    if (error) {
      window.alert(error.message)
      return
    }

    setDraft(emptyProject)
    setPanelOpen(false)
    await load()
  }

  async function openPipeline(project: Project) {
    window.localStorage.setItem('current_project_id', project.id)
    await updateProject(project.id, { last_visited_at: new Date().toISOString() })
    router.push(getPipelinePath(getProjectPipeline(project.type, project.category), project.pipeline_step))
  }

  return (
    <DashboardShell activeSection="work">
      <section className="board-page">
        <header className="board-toolbar">
          <div>
            <h1>我的工作</h1>
            <p>內容製作 pipeline board</p>
          </div>
          <button className="primary-button" type="button" onClick={() => setPanelOpen(true)}>
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
                <tr key={project.id}>
                  <td>
                    <EditableText value={project.title} onSave={(title) => updateProject(project.id, { title })} />
                  </td>
                  <td>
                    <CategoryTag category={project.category} />
                  </td>
                  <td>
                    <select
                      value={project.status}
                      onChange={(event) =>
                        void updateProject(project.id, { status: event.target.value as ProjectStatus })
                      }
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <StatusBadge status={project.status} />
                  </td>
                  <td>
                    <select
                      value={project.current_stage}
                      onChange={(event) =>
                        void updateProject(project.id, { current_stage: event.target.value as ProjectStage })
                      }
                    >
                      {stageOptions.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <EditableText value={project.host ?? ''} onSave={(host) => updateProject(project.id, { host })} />
                  </td>
                  <td>
                    <EditableText value={project.owner ?? ''} onSave={(owner) => updateProject(project.id, { owner })} />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={project.shoot_date ?? ''}
                      onChange={(event) =>
                        void updateProject(project.id, { shoot_date: event.target.value || null })
                      }
                    />
                  </td>
                  <td>
                    <button className="pipeline-cell" type="button" onClick={() => void openPipeline(project)}>
                      <PipelineProgress step={project.pipeline_step} />
                      <span>{project.pipeline_step}</span>
                    </button>
                  </td>
                  <td>
                    {project.output_url ? (
                      <a href={project.output_url} target="_blank" rel="noreferrer">
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

      {panelOpen && (
        <aside className="slide-panel">
          <div className="panel-head">
            <h2>新項目</h2>
            <button type="button" onClick={() => setPanelOpen(false)}>
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
          <button className="primary-button" type="button" onClick={() => void createProject()}>
            建立項目
          </button>
        </aside>
      )}
    </DashboardShell>
  )
}

function EditableText({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <input
      value={localValue}
      onChange={(event) => setLocalValue(event.target.value)}
      onBlur={() => {
        if (localValue !== value) onSave(localValue)
      }}
    />
  )
}
