'use client'

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import { supabase } from '@/lib/supabase'
import type { CoreDoc, Workspace } from '@/lib/types'

type BriefLang = 'zh' | 'en'

const briefLangStorageKey = 'soon-brief-lang'

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
  language: BriefLang
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

const briefCopy = {
  zh: {
    toggle: '中文',
    back: '← 文件中心',
    save: 'Save',
    saved: '已儲存',
    saving: '儲存中...',
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
  const [docs, setDocs] = useState<CoreDoc[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedDoc, setSelectedDoc] = useState<CoreDoc | null>(null)
  const [content, setContent] = useState('')
  const [projectBrief, setProjectBrief] = useState<ProjectBriefContent>(defaultProjectBrief)
  const [workspaceId, setWorkspaceId] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const copy = useMemo(() => briefCopy[projectBrief.language], [projectBrief.language])

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

  function getStoredBriefLanguage(): BriefLang {
    if (typeof window === 'undefined') return 'zh'
    return window.localStorage.getItem(briefLangStorageKey) === 'en' ? 'en' : 'zh'
  }

  async function createDoc(template: Template) {
    const initialBrief = { ...defaultProjectBrief, language: getStoredBriefLanguage() }
    const initialContent =
      template.type === 'project_brief'
        ? JSON.stringify(initialBrief)
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
          <header className="brief-toolbar">
            <div className="brief-toolbar-left">
              <button type="button" onClick={closeDoc}>
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
              <button className="primary-button" type="button" onClick={() => void saveProjectBrief()}>
                {copy.save}
              </button>
            </div>
          </header>

          <article className="brief-document">
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
                    onChange={(event) =>
                      updateProjectBrief('status', event.target.value as ProjectBriefContent['status'])
                    }
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
              <button className="add-row-button" type="button" onClick={addStakeholder}>
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
