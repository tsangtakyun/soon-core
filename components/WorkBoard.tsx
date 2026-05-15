'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { KeyboardEvent, useEffect, useMemo, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import PageHeader from '@/components/PageHeader'
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
const sortStorageKey = 'soon-work-sort'

type SortKey = 'created_at' | 'shoot_date' | 'publish_date' | 'title' | 'status' | 'current_stage'
type SortDirection = 'asc' | 'desc'
type SortState = {
  key: SortKey
  direction: SortDirection
  label: string
}

type ProjectDraft = {
  title: string
  category: ProjectCategory
  host: string
  owner: string
  shoot_date: string
  publish_date: string
  status: ProjectStatus
  current_stage: ProjectStage
  workspace_id: string
  pipeline_step: PipelineStep
  output_url: string
}

const defaultSort: SortState = { key: 'created_at', direction: 'desc', label: '最新建立' }

const sortOptions: SortState[] = [
  defaultSort,
  { key: 'created_at', direction: 'asc', label: '最舊建立' },
  { key: 'shoot_date', direction: 'asc', label: '拍攝日期 近→遠' },
  { key: 'shoot_date', direction: 'desc', label: '拍攝日期 遠→近' },
  { key: 'publish_date', direction: 'asc', label: '發佈時間 近→遠' },
  { key: 'publish_date', direction: 'desc', label: '發佈時間 遠→近' },
  { key: 'title', direction: 'asc', label: '題目 A→Z' },
  { key: 'status', direction: 'asc', label: 'Status 1→7' },
  { key: 'status', direction: 'desc', label: 'Status 7→1' },
]

const emptyProject: ProjectDraft = {
  title: '',
  category: 'youtube',
  host: '',
  owner: '',
  shoot_date: '',
  publish_date: '',
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
  const [sort, setSort] = useState<SortState>(defaultSort)
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [draft, setDraft] = useState<ProjectDraft>(emptyProject)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const saved = window.localStorage.getItem(sortStorageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SortState
        if (sortOptions.some((option) => option.key === parsed.key && option.direction === parsed.direction)) {
          setSort({
            ...parsed,
            label:
              sortOptions.find((option) => option.key === parsed.key && option.direction === parsed.direction)?.label ??
              parsed.label,
          })
        }
      } catch {
        window.localStorage.removeItem(sortStorageKey)
      }
    }
  }, [])

  useEffect(() => {
    setSort(defaultSort)
    window.localStorage.setItem(sortStorageKey, JSON.stringify(defaultSort))
    void load()
  }, [workspaceFilter])

  useEffect(() => {
    const refresh = () => void load()
    window.addEventListener('soon-workspaces-changed', refresh)
    return () => window.removeEventListener('soon-workspaces-changed', refresh)
  }, [])

  async function load() {
    const response = await fetch('/api/projects', { cache: 'no-store' })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      window.alert(result.error || '載入項目失敗')
      setProjects([])
      setWorkspaces([])
      return
    }

    setProjects((result.projects ?? []) as Project[])
    setWorkspaces((result.workspaces ?? []) as Workspace[])
    setSelectedProjectIds(new Set())
  }

  function setAndPersistSort(nextSort: SortState) {
    setSort(nextSort)
    window.localStorage.setItem(sortStorageKey, JSON.stringify(nextSort))
  }

  function toggleColumnSort(key: SortKey) {
    const direction: SortDirection = sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc'
    setAndPersistSort({
      key,
      direction,
      label: `${columnSortLabels[key]} ${direction === 'asc' ? '↑' : '↓'}`,
    })
  }

  const activeWorkspaceName =
    workspaces.find((workspace) => workspace.id === workspaceFilter)?.name ?? (workspaceFilter ? '未找到' : '全部')

  const visibleProjects = useMemo(() => {
    const filtered = projects.filter((project) => {
      if (workspaceFilter && project.workspace_id !== workspaceFilter) return false
      if (statusFilter && project.status !== statusFilter) return false
      if (categoryFilter && project.category !== categoryFilter) return false
      if (ownerFilter && (project.owner ?? '') !== ownerFilter) return false
      if (query && !project.title.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })

    return [...filtered].sort((a, b) => compareProjects(a, b, sort))
  }, [categoryFilter, ownerFilter, projects, query, sort, statusFilter, workspaceFilter])

  const owners = Array.from(new Set(projects.map((project) => project.owner).filter(Boolean))) as string[]
  const visibleProjectIds = visibleProjects.map((project) => project.id)
  const selectedCount = selectedProjectIds.size
  const allVisibleSelected =
    visibleProjectIds.length > 0 && visibleProjectIds.every((projectId) => selectedProjectIds.has(projectId))

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
      publish_date: project.publish_date ?? '',
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

  function toggleProjectSelection(projectId: string) {
    setSelectedProjectIds((current) => {
      const next = new Set(current)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  function toggleAllVisibleProjects() {
    setSelectedProjectIds((current) => {
      if (allVisibleSelected) {
        return new Set([...current].filter((projectId) => !visibleProjectIds.includes(projectId)))
      }

      return new Set([...current, ...visibleProjectIds])
    })
  }

  async function deleteSelectedProjects() {
    const ids = Array.from(selectedProjectIds)
    if (ids.length === 0) return

    if (!window.confirm(`確定刪除 ${ids.length} 個項目？此動作不可復原。`)) {
      return
    }

    const response = await fetch('/api/projects', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      window.alert(result.error || '刪除項目失敗')
      return
    }

    await load()
    window.dispatchEvent(new Event('soon-data-updated'))
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
      publish_date: draft.publish_date || null,
      status: draft.status,
      current_stage: draft.current_stage,
      workspace_id: draft.workspace_id || null,
      pipeline_step: draft.pipeline_step,
      output_url: draft.output_url.trim() || null,
    }

    const response = await fetch('/api/projects', {
      method: panelMode === 'edit' && selectedProject ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        panelMode === 'edit' && selectedProject
          ? { id: selectedProject.id, ...payload }
          : { ...payload, languages: 3 }
      ),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      window.alert(result.error || '儲存項目失敗')
      return
    }

    closePanel()
    await load()
    window.dispatchEvent(new Event('soon-data-updated'))
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
        <PageHeader
          icon="📋"
          title="我的工作"
          subtitle="內容製作追蹤板"
          actions={(
          <button className="primary-button" type="button" onClick={openCreatePanel}>
            + 新項目
          </button>
          )}
        />
        <p className="active-workspace-line">工作區：{activeWorkspaceName}</p>

        <div className="filters work-filters">
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
          <select
            value={`${sort.key}:${sort.direction}`}
            onChange={(event) => {
              const next = sortOptions.find((option) => `${option.key}:${option.direction}` === event.target.value)
              if (next) setAndPersistSort(next)
            }}
            aria-label="排序"
          >
            {sortOptions.map((option) => (
              <option key={`${option.key}:${option.direction}`} value={`${option.key}:${option.direction}`}>
                排序：{option.label}
              </option>
            ))}
          </select>
        </div>

        {selectedCount > 0 && (
          <div className="work-bulk-action-bar">
            <span>已選取 {selectedCount} 個項目</span>
            <span className="work-bulk-spacer" />
            <button className="work-ghost-button" type="button" onClick={() => setSelectedProjectIds(new Set())}>
              取消選取
            </button>
            <button className="work-bulk-delete-button" type="button" onClick={() => void deleteSelectedProjects()}>
              刪除所選
            </button>
          </div>
        )}

        <div className="work-table-wrap">
          <table className="work-table">
            <thead>
              <tr>
                <th className="work-select-cell">
                  <input
                    aria-label="選取全部項目"
                    checked={allVisibleSelected}
                    type="checkbox"
                    onChange={toggleAllVisibleProjects}
                  />
                </th>
                <SortableHeader label="題目" sortKey="title" activeSort={sort} onSort={toggleColumnSort} />
                <th>類別</th>
                <SortableHeader label="Status" sortKey="status" activeSort={sort} onSort={toggleColumnSort} />
                <SortableHeader label="當前工序" sortKey="current_stage" activeSort={sort} onSort={toggleColumnSort} />
                <th>主持</th>
                <th>負責人</th>
                <SortableHeader label="拍攝日期" sortKey="shoot_date" activeSort={sort} onSort={toggleColumnSort} />
                <SortableHeader label="發佈時間" sortKey="publish_date" activeSort={sort} onSort={toggleColumnSort} />
                <th>Pipeline</th>
                <th>Output</th>
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((project) => (
                <tr
                  key={project.id}
                  className={selectedProjectIds.has(project.id) ? 'work-row-selected' : undefined}
                  tabIndex={0}
                  onClick={() => openEditPanel(project)}
                  onKeyDown={(event) => handleRowKey(event, project)}
                >
                  <td className="work-select-cell">
                    <input
                      aria-label={`選取 ${project.title}`}
                      checked={selectedProjectIds.has(project.id)}
                      type="checkbox"
                      onChange={() => toggleProjectSelection(project.id)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </td>
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
                    <span className="shoot-date">{project.publish_date ?? '未定'}</span>
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
            發佈時間
            <input
              type="date"
              value={draft.publish_date}
              onChange={(event) => setDraft({ ...draft, publish_date: event.target.value })}
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

const columnSortLabels: Record<SortKey, string> = {
  created_at: '建立日期',
  shoot_date: '拍攝日期',
  publish_date: '發佈時間',
  title: '題目',
  status: 'Status',
  current_stage: '當前工序',
}

function compareProjects(a: Project, b: Project, sort: SortState) {
  const modifier = sort.direction === 'asc' ? 1 : -1

  if (sort.key === 'status') {
    return (statusOptions.indexOf(a.status) - statusOptions.indexOf(b.status)) * modifier
  }

  const aValue = getSortValue(a, sort.key)
  const bValue = getSortValue(b, sort.key)
  return aValue.localeCompare(bValue, 'zh-HK', { numeric: true }) * modifier
}

function getSortValue(project: Project, key: SortKey) {
  if (key === 'shoot_date') return project.shoot_date ?? '9999-12-31'
  if (key === 'publish_date') return project.publish_date ?? '9999-12-31'
  if (key === 'created_at') return project.created_at
  if (key === 'current_stage') return project.current_stage
  return project.title
}

function SortableHeader({
  label,
  sortKey,
  activeSort,
  onSort,
}: {
  label: string
  sortKey: SortKey
  activeSort: SortState
  onSort: (key: SortKey) => void
}) {
  const active = activeSort.key === sortKey
  return (
    <th className={active ? 'sortable-header active' : 'sortable-header'}>
      <button type="button" onClick={() => onSort(sortKey)}>
        {label}
        {active && <span>{activeSort.direction === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  )
}
