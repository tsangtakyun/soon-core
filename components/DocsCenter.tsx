'use client'

import { useEffect, useState } from 'react'

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

const templateLabels = Object.fromEntries(templates.map((template) => [template.type, template.title]))
const templateIcons = Object.fromEntries(templates.map((template) => [template.type, template.icon]))

export function DocsCenter() {
  const [docs, setDocs] = useState<CoreDoc[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedDoc, setSelectedDoc] = useState<CoreDoc | null>(null)
  const [content, setContent] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const [{ data: docData }, { data: workspaceData }] = await Promise.all([
      supabase.from('docs').select('*').order('created_at', { ascending: false }),
      supabase.from('workspaces').select('*').order('created_at', { ascending: false }),
    ])

    setDocs((docData ?? []) as CoreDoc[])
    setWorkspaces((workspaceData ?? []) as Workspace[])
  }

  async function createDoc(template: (typeof templates)[number]) {
    const { data, error } = await supabase
      .from('docs')
      .insert({
        title: template.title,
        template_type: template.type,
        workspace_id: workspaceId || null,
        content: template.preview.join('\n'),
      })
      .select()
      .single()

    if (error) {
      window.alert(error.message)
      return
    }

    const doc = data as CoreDoc
    setDocs((current) => [doc, ...current])
    setSelectedDoc(doc)
    setContent(doc.content ?? '')
  }

  async function saveDoc() {
    if (!selectedDoc) return
    const { error } = await supabase.from('docs').update({ content }).eq('id', selectedDoc.id)
    if (error) {
      window.alert(error.message)
      return
    }
    await load()
  }

  function openDoc(doc: CoreDoc) {
    setSelectedDoc(doc)
    setContent(doc.content ?? '')
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
                onChange={(event) => setContent(event.target.value)}
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
