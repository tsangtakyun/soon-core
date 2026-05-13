'use client'

import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { CoreDoc } from '@/lib/types'

type Props = {
  doc: CoreDoc
  onBack: () => void
  onSaved: (doc: CoreDoc) => void
}

type BlankDocumentContent = {
  title: string
  body: string
  createdAt: string
  updatedAt: string
}

function createBlankContent(): BlankDocumentContent {
  const now = new Date().toISOString()
  return {
    title: '',
    body: '',
    createdAt: now,
    updatedAt: now,
  }
}

function parseBlankContent(content: string | null): BlankDocumentContent {
  if (!content) return createBlankContent()
  try {
    const parsed = JSON.parse(content) as Partial<BlankDocumentContent>
    const fallback = createBlankContent()
    return {
      ...fallback,
      ...parsed,
      title: parsed.title ?? '',
      body: parsed.body ?? '',
    }
  } catch {
    const fallback = createBlankContent()
    return { ...fallback, body: content }
  }
}

export function BlankDocumentEditor({ doc, onBack, onSaved }: Props) {
  const [content, setContent] = useState<BlankDocumentContent>(() => parseBlankContent(doc.content))
  const [logoBase64, setLogoBase64] = useState('')
  const [companyName, setCompanyName] = useState('SOON Studio')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void loadSettings()
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void saveDocument(false)
    }, 30000)
    return () => window.clearInterval(interval)
  }, [content])

  async function loadSettings() {
    const { data } = await supabase
      .from('settings')
      .select('logo_base64, company_name')
      .eq('user_id', 'tommy')
      .maybeSingle()
    setLogoBase64(String(data?.logo_base64 ?? ''))
    setCompanyName(String(data?.company_name ?? 'SOON Studio'))
  }

  function updateContent(patch: Partial<BlankDocumentContent>) {
    setSaved(false)
    setContent((current) => ({ ...current, ...patch }))
  }

  async function saveDocument(showIndicator = true) {
    const nextContent = { ...content, updatedAt: new Date().toISOString() }
    const title = nextContent.title.trim() || '未命名文件'
    const { data, error } = await supabase
      .from('docs')
      .update({ title, content: JSON.stringify(nextContent) })
      .eq('id', doc.id)
      .select()
      .single()
    if (error) {
      if (showIndicator) window.alert(error.message)
      return
    }
    setContent(nextContent)
    setSaved(true)
    onSaved(data as CoreDoc)
  }

  function exportPdf() {
    window.print()
  }

  function exportWord() {
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a}h1{font-size:28px}.meta{font-size:12px;color:#888;margin-bottom:24px}p{font-size:14px;line-height:1.8;white-space:pre-wrap}</style></head><body><h1>${escapeHtml(content.title || '未命名文件')}</h1><div class="meta">建立者 Tommy · 日期 ${formatDate(content.createdAt)}</div><p>${escapeHtml(content.body)}</p></body></html>`
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${sanitizeFilename(content.title || 'blank-document')}.doc`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="script-editor-page blank-document-editor">
      <header className="brief-toolbar invoice-toolbar script-toolbar soon-no-print">
        <button type="button" onClick={onBack}>← 文件中心</button>
        <span className="toolbar-spacer" />
        <button className="export-button export-pdf-button" type="button" onClick={exportPdf}>匯出 PDF</button>
        <button className="export-button export-word-button" type="button" onClick={exportWord}>匯出 Word</button>
        <button className="primary-button" type="button" onClick={() => void saveDocument()}>Save</button>
        {saved && <span className="saved-indicator">已儲存</span>}
      </header>

      <article className="blank-document soon-print-doc">
        <div className="doc-logo-area">
          {logoBase64 ? <img src={logoBase64} alt="" /> : <span>{companyName}</span>}
        </div>
        <input
          className="blank-document-title"
          value={content.title}
          placeholder="未命名文件"
          onChange={(event) => updateContent({ title: event.target.value })}
        />
        <p className="script-meta">建立者 Tommy · 日期 {formatDate(content.createdAt)}</p>
        <textarea
          className="blank-document-body"
          value={content.body}
          placeholder="開始輸入內容..."
          onChange={(event) => updateContent({ body: event.target.value })}
        />
        <div className="print-text">{content.body}</div>
      </article>
    </section>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-HK')
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char)
}

function sanitizeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').toLowerCase() || 'blank-document'
}
