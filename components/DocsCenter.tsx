'use client'

import { useEffect, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import { supabase } from '@/lib/supabase'
import type { CoreDoc, Workspace } from '@/lib/types'

const templates = [
  { type: 'project_brief', icon: '📋', title: 'Project Brief' },
  { type: 'invoice', icon: '🧾', title: 'Invoice' },
  { type: 'quotation', icon: '💬', title: 'Quotation' },
  { type: 'ig_script', icon: '📱', title: 'IG Script Template' },
  { type: 'youtube_script', icon: '▶️', title: 'YouTube Script Template' },
]

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
        content: '',
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

  return (
    <DashboardShell activeSection="docs">
      <section className="docs-page">
        <header className="board-toolbar">
          <div>
            <h1>文件中心</h1>
            <p>建立常用 production 文件同模板</p>
          </div>
          <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
            <option value="">未指定工作區</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </header>

        <div className="template-grid">
          {templates.map((template) => (
            <article key={template.type} className="template-card">
              <div className="template-icon">{template.icon}</div>
              <h2>{template.title}</h2>
              <button className="primary-button" type="button" onClick={() => void createDoc(template)}>
                新建
              </button>
            </article>
          ))}
        </div>

        <section className="docs-layout">
          <div className="docs-list">
            <h2>已有文件</h2>
            {docs.map((doc) => (
              <button
                key={doc.id}
                className={selectedDoc?.id === doc.id ? 'active' : ''}
                type="button"
                onClick={() => {
                  setSelectedDoc(doc)
                  setContent(doc.content ?? '')
                }}
              >
                <strong>{doc.title}</strong>
                <span>{new Date(doc.created_at).toLocaleDateString('zh-HK')}</span>
              </button>
            ))}
            {docs.length === 0 && <p className="muted">未有文件</p>}
          </div>

          <div className="doc-editor">
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
              <div className="empty-card">選擇或新建一份文件</div>
            )}
          </div>
        </section>
      </section>
    </DashboardShell>
  )
}
