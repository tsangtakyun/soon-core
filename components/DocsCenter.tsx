'use client'

import { type ChangeEvent, type ReactNode, useEffect, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import { supabase } from '@/lib/supabase'
import type { CoreDoc, Workspace } from '@/lib/types'

const templates = [
  {
    type: 'project_brief',
    icon: '📋',
    title: 'Project Brief',
    accent: '#7c3aed',
    preview: ['客戶名稱 _____', '項目類型 _____', '預算範圍 _____', '拍攝日期 _____'],
  },
  {
    type: 'invoice',
    icon: '🧾',
    title: 'Invoice',
    accent: '#0ea5e9',
    preview: ['發票號碼 INV-001', '客戶 _____', '服務項目 _____', '總金額 HK$_____'],
  },
  {
    type: 'quotation',
    icon: '💬',
    title: 'Quotation',
    accent: '#f97316',
    preview: ['報價單 QUO-001', '有效期 30日', '拍攝費用 _____', '後期費用 _____'],
  },
  {
    type: 'ig_script',
    icon: '📱',
    title: 'IG Script Template',
    accent: '#ec4899',
    preview: ['Hook _____', '背景介紹 _____', '轉場 _____', '結尾 _____'],
  },
  {
    type: 'youtube_script',
    icon: '▶',
    title: 'YouTube Script Template',
    accent: '#ef4444',
    preview: ['開場白 _____', '主題介紹 _____', '內容分段 _____', 'CTA _____'],
  },
] as const

type Template = (typeof templates)[number]

type Stakeholder = {
  name: string
  role: string
  involvement: string
}

type ProjectBriefContent = {
  title: string
  projectName: string
  owner: string
  status: 'Planning' | 'In Progress' | 'On Hold' | 'Done'
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

const templateLabels = Object.fromEntries(templates.map((template) => [template.type, template.title]))
const templateIcons = Object.fromEntries(templates.map((template) => [template.type, template.icon]))
const projectBriefStatusOptions: ProjectBriefContent['status'][] = ['Planning', 'In Progress', 'On Hold', 'Done']

const defaultProjectBrief: ProjectBriefContent = {
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
  const [docs, setDocs] = useState<CoreDoc[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedDoc, setSelectedDoc] = useState<CoreDoc | null>(null)
  const [content, setContent] = useState('')
  const [projectBrief, setProjectBrief] = useState<ProjectBriefContent>(defaultProjectBrief)
  const [workspaceId, setWorkspaceId] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!selectedDoc || selectedDoc.template_type !== 'project_brief') return
    const interval = window.setInterval(() => {
      void saveProjectBrief(false)
    }, 30000)
    return () => window.clearInterval(interval)
  }, [selectedDoc, projectBrief])

  async function load() {
    const [{ data: docData }, { data: workspaceData }] = await Promise.all([
      supabase.from('docs').select('*').order('created_at', { ascending: false }),
      supabase.from('workspaces').select('*').order('created_at', { ascending: false }),
    ])

    setDocs((docData ?? []) as CoreDoc[])
    setWorkspaces((workspaceData ?? []) as Workspace[])
  }

  async function createDoc(template: Template) {
    const initialContent =
      template.type === 'project_brief'
        ? JSON.stringify(defaultProjectBrief)
        : template.preview.join('\n')

    const { data, error } = await supabase
      .from('docs')
      .insert({
        title: template.title,
        template_type: template.type,
        workspace_id: workspaceId || null,
        content: initialContent,
      })
      .select()
      .single()

    if (error) {
      window.alert(error.message)
      return
    }

    openDoc(data as CoreDoc, [data as CoreDoc, ...docs])
  }

  async function saveDoc() {
    if (!selectedDoc) return
    const { error } = await supabase.from('docs').update({ content }).eq('id', selectedDoc.id)
    if (error) {
      window.alert(error.message)
      return
    }
    setSaveState('saved')
    await load()
  }

  async function saveProjectBrief(showAlert = true) {
    if (!selectedDoc || selectedDoc.template_type !== 'project_brief') return

    const nextContent = { ...projectBrief, updatedAt: new Date().toISOString() }
    setSaveState('saving')
    const { data, error } = await supabase
      .from('docs')
      .update({
        title: nextContent.title || 'Project Brief',
        content: JSON.stringify(nextContent),
      })
      .eq('id', selectedDoc.id)
      .select()
      .single()

    if (error) {
      if (showAlert) window.alert(error.message)
      setSaveState('idle')
      return
    }

    setProjectBrief(nextContent)
    setSelectedDoc(data as CoreDoc)
    setDocs((current) => current.map((doc) => (doc.id === selectedDoc.id ? (data as CoreDoc) : doc)))
    setSaveState('saved')
  }

  function openDoc(doc: CoreDoc, nextDocs = docs) {
    setSelectedDoc(doc)
    setSaveState('idle')
    if (doc.template_type === 'project_brief') {
      setProjectBrief(parseProjectBrief(doc.content))
    } else {
      setContent(doc.content ?? '')
    }
    setDocs(nextDocs)
  }

  function closeDoc() {
    setSelectedDoc(null)
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
    return (
      <DashboardShell activeSection="docs">
        <section className="brief-editor-page">
          <header className="brief-toolbar">
            <button type="button" onClick={closeDoc}>
              ← 文件中心
            </button>
            <input
              aria-label="文件標題"
              value={projectBrief.title}
              onChange={(event) => updateProjectBrief('title', event.target.value)}
            />
            <div className="brief-toolbar-actions">
              {saveState === 'saved' && <span>已儲存</span>}
              {saveState === 'saving' && <span>儲存中...</span>}
              <button className="primary-button" type="button" onClick={() => void saveProjectBrief()}>
                Save
              </button>
            </div>
          </header>

          <article className="brief-document">
            <input
              className="brief-title-input"
              value={projectBrief.title}
              onChange={(event) => updateProjectBrief('title', event.target.value)}
            />
            <div className="brief-meta">
              建立者 Tommy · 已建立 {formatDate(selectedDoc.created_at)} · 最近更新{' '}
              {formatDate(projectBrief.updatedAt ?? selectedDoc.created_at)}
            </div>

            <table className="brief-info-table">
              <tbody>
                <BriefInfoRow label="Project name">
                  <input
                    value={projectBrief.projectName}
                    onChange={(event) => updateProjectBrief('projectName', event.target.value)}
                  />
                </BriefInfoRow>
                <BriefInfoRow label="Owner">
                  <input
                    value={projectBrief.owner}
                    onChange={(event) => updateProjectBrief('owner', event.target.value)}
                  />
                </BriefInfoRow>
                <BriefInfoRow label="Status">
                  <select
                    value={projectBrief.status}
                    onChange={(event) =>
                      updateProjectBrief('status', event.target.value as ProjectBriefContent['status'])
                    }
                  >
                    {projectBriefStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </BriefInfoRow>
                <BriefInfoRow label="Start date">
                  <input
                    type="date"
                    value={projectBrief.startDate}
                    onChange={(event) => updateProjectBrief('startDate', event.target.value)}
                  />
                </BriefInfoRow>
                <BriefInfoRow label="Target date">
                  <input
                    type="date"
                    value={projectBrief.targetDate}
                    onChange={(event) => updateProjectBrief('targetDate', event.target.value)}
                  />
                </BriefInfoRow>
                <BriefInfoRow label="Team">
                  <input value={projectBrief.team} onChange={(event) => updateProjectBrief('team', event.target.value)} />
                </BriefInfoRow>
              </tbody>
            </table>

            <BriefSection title="❓ Problem Statement">
              <AutoTextarea
                value={projectBrief.problemStatement}
                placeholder="我哋解決緊咩問題？對象係誰？唔解決會有咩影響？"
                onChange={(value) => updateProjectBrief('problemStatement', value)}
              />
            </BriefSection>

            <BriefSection title="🎯 Goals and Success Metrics">
              <BriefSubsection label="Goals">
                <AutoTextarea
                  value={projectBrief.goals}
                  placeholder={'目標 1\n目標 2'}
                  onChange={(value) => updateProjectBrief('goals', value)}
                />
              </BriefSubsection>
              <BriefSubsection label="How will we measure success?">
                <AutoTextarea
                  value={projectBrief.successMetrics}
                  placeholder={'指標 1\n指標 2'}
                  onChange={(value) => updateProjectBrief('successMetrics', value)}
                />
              </BriefSubsection>
            </BriefSection>

            <BriefSection title="📦 Scope">
              <BriefSubsection label="In scope">
                <AutoTextarea
                  value={projectBrief.inScope}
                  placeholder="範圍內項目"
                  onChange={(value) => updateProjectBrief('inScope', value)}
                />
              </BriefSubsection>
              <BriefSubsection label="Out of scope">
                <AutoTextarea
                  value={projectBrief.outOfScope}
                  placeholder="範圍外項目"
                  onChange={(value) => updateProjectBrief('outOfScope', value)}
                />
              </BriefSubsection>
            </BriefSection>

            <BriefSection title="👥 Key Stakeholders">
              <table className="stakeholder-table">
                <thead>
                  <tr>
                    <th>名稱</th>
                    <th>角色</th>
                    <th>參與程度</th>
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
              <button className="add-row-button" type="button" onClick={addStakeholder}>
                + 新增
              </button>
            </BriefSection>

            <BriefSection title="⚠️ Risks and Dependencies">
              <BriefSubsection label="Risks">
                <AutoTextarea value={projectBrief.risks} onChange={(value) => updateProjectBrief('risks', value)} />
              </BriefSubsection>
              <BriefSubsection label="Dependencies">
                <AutoTextarea
                  value={projectBrief.dependencies}
                  onChange={(value) => updateProjectBrief('dependencies', value)}
                />
              </BriefSubsection>
            </BriefSection>

            <BriefSection title="🤔 Open Questions">
              <AutoTextarea
                value={projectBrief.openQuestions}
                placeholder={'問題 1\n問題 2'}
                onChange={(value) => updateProjectBrief('openQuestions', value)}
              />
            </BriefSection>
          </article>
        </section>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell activeSection="docs">
      <section className="docs-page">
        <header className="docs-header">
          <div>
            <h1>文件中心</h1>
            <p>建立常用 production 文件同模板</p>
          </div>
          <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
            <option value="">全部工作區</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </header>

        <div className="template-grid docs-template-grid">
          {templates.map((template) => (
            <article key={template.type} className="template-card docs-template-card">
              <div className="template-accent" style={{ background: template.accent }} />
              <div className="template-title-row">
                <span className="template-icon" style={{ color: template.accent }}>
                  {template.icon}
                </span>
                <h2>{template.title}</h2>
              </div>
              <div className="template-preview">
                {template.preview.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
              <button className="template-create-button" type="button" onClick={() => void createDoc(template)}>
                新建
              </button>
            </article>
          ))}
        </div>

        <section className="existing-docs-section">
          <h2>已有文件</h2>
          <div className="existing-docs-list">
            {docs.map((doc) => (
              <div key={doc.id} className={selectedDoc?.id === doc.id ? 'doc-row active' : 'doc-row'}>
                <span className="doc-row-icon">{templateIcons[doc.template_type ?? ''] ?? '📄'}</span>
                <strong>{doc.title}</strong>
                <span className="doc-type-badge">
                  {templateLabels[doc.template_type ?? ''] ?? doc.template_type ?? 'Document'}
                </span>
                <time>{new Date(doc.created_at).toLocaleDateString('zh-HK')}</time>
                <button type="button" onClick={() => openDoc(doc)}>
                  開啟
                </button>
              </div>
            ))}
            {docs.length === 0 && <p className="docs-empty">未有文件</p>}
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
      </section>
    </DashboardShell>
  )
}

function parseProjectBrief(content: string | null): ProjectBriefContent {
  if (!content) return defaultProjectBrief
  try {
    const parsed = JSON.parse(content) as Partial<ProjectBriefContent>
    return {
      ...defaultProjectBrief,
      ...parsed,
      stakeholders:
        parsed.stakeholders && parsed.stakeholders.length > 0
          ? parsed.stakeholders
          : defaultProjectBrief.stakeholders,
    }
  } catch {
    return { ...defaultProjectBrief, problemStatement: content }
  }
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
