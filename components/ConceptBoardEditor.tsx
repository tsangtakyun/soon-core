'use client'

import { useMemo, useState } from 'react'

import {
  conceptBoardLangStorageKey,
  conceptHasContent,
  createEmptyConcept,
  parseConceptBoard,
  type ClientBrief,
  type ConceptBoardContent,
  type ConceptBoardLanguage,
  type ConceptBreakdownRow,
  type ConceptIntegrationItem,
  type ConceptReferenceRow,
  type ConceptSection,
} from '@/lib/concept-board'
import { supabase } from '@/lib/supabase'
import type { CoreDoc } from '@/lib/types'

type Props = {
  doc: CoreDoc
  onBack: () => void
  onSaved: (doc: CoreDoc) => void
}

type PdfWindow = Window & {
  pdfjsLib?: {
    GlobalWorkerOptions: { workerSrc: string }
    getDocument: (input: { data: Uint8Array }) => { promise: Promise<PdfDocument> }
  }
  mammoth?: {
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
  }
}

type PdfDocument = {
  numPages: number
  getPage: (pageNumber: number) => Promise<{
    getTextContent: () => Promise<{ items: Array<{ str?: string }> }>
  }>
}

const conceptCopy = {
  zh: {
    back: '← 文件中心',
    chinese: '中文',
    english: 'English',
    importBrief: '📎 匯入 Client Brief',
    briefUploaded: (count: number) => `已上載 ${count} 份 Brief`,
    ai: '✨ AI 優化',
    aiTitle: 'AI 優化建議',
    pdf: '匯出 PDF',
    word: '匯出 Word',
    save: 'Save',
    saved: '已儲存',
    title: 'Concept Board',
    meta: (created: string, updated: string) => `建立者 Tommy · 日期 ${created} · 最近更新 ${updated}`,
    client: '客戶',
    project: '項目',
    addConcept: '+ 新增 Concept',
    deleteConcept: '刪除此 Concept',
    confirmDeleteConcept: '確定刪除此 Concept？',
    cover: '封面參考',
    uploadCover: '點擊或拖拽上傳封面參考圖',
    replaceImage: '點擊更換圖片',
    titleLabel: '題目',
    titlePlaceholder: '例：首爾街頭交爆朋友！竟然咁熱情？',
    subtitle: '副題',
    subtitlePlaceholder: '例：免費機位：我用AI學韓文一星期，喺首爾識咗5個新朋友？！',
    productIntegration: '產品置入方向',
    addItem: '+ 新增',
    breakdown: '內容分段',
    segmentName: '段落名稱',
    segmentDescription: '內容描述',
    segmentTime: '大概時間',
    addSegment: '+ 新增段落',
    addImage: '+ 圖',
    pastReferences: '過往參考',
    views: '觀看次數',
    airDate: '播出日期',
    link: '連結',
    description: '簡介',
    addReference: '+ 新增 Reference',
  },
  en: {
    back: '← Docs Center',
    chinese: '中文',
    english: 'English',
    importBrief: '📎 Import Client Brief',
    briefUploaded: (count: number) => `${count} brief${count === 1 ? '' : 's'} uploaded`,
    ai: '✨ AI Review',
    aiTitle: 'AI Review Suggestions',
    pdf: 'Export PDF',
    word: 'Export Word',
    save: 'Save',
    saved: 'Saved',
    title: 'Concept Board',
    meta: (created: string, updated: string) => `Created by Tommy · Date ${created} · Last updated ${updated}`,
    client: 'Client',
    project: 'Project',
    addConcept: '+ Add Concept',
    deleteConcept: 'Delete Concept',
    confirmDeleteConcept: 'Delete this concept?',
    cover: 'Cover Reference',
    uploadCover: 'Click or drag to upload cover reference',
    replaceImage: 'Click to replace image',
    titleLabel: 'Title',
    titlePlaceholder: 'e.g. Seoul street challenge: are locals really this friendly?',
    subtitle: 'Subtitle',
    subtitlePlaceholder: 'e.g. I used AI to learn Korean for one week and met five new friends in Seoul',
    productIntegration: 'Product Integration',
    addItem: '+ Add',
    breakdown: 'Content Breakdown',
    segmentName: 'Segment',
    segmentDescription: 'Description',
    segmentTime: 'Time',
    addSegment: '+ Add Segment',
    addImage: '+ Image',
    pastReferences: 'Past References',
    views: 'Views',
    airDate: 'Air Date',
    link: 'Link',
    description: 'Description',
    addReference: '+ Add Reference',
  },
} as const

export function ConceptBoardEditor({ doc, onBack, onSaved }: Props) {
  const [board, setBoard] = useState<ConceptBoardContent>(() => parseConceptBoard(doc.content, getStoredLanguage()))
  const [saved, setSaved] = useState(false)
  const [briefs, setBriefs] = useState<ClientBrief[]>([])
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiText, setAiText] = useState('')
  const t = conceptCopy[board.language]
  const canReview = useMemo(() => board.concepts.some(conceptHasContent), [board.concepts])

  function setLanguage(language: ConceptBoardLanguage) {
    window.localStorage.setItem(conceptBoardLangStorageKey, language)
    updateBoard({ language })
  }

  function updateBoard(patch: Partial<ConceptBoardContent>) {
    setSaved(false)
    setBoard((current) => ({ ...current, ...patch }))
  }

  function updateConcept(conceptId: string, patch: Partial<ConceptSection>) {
    setSaved(false)
    setBoard((current) => ({
      ...current,
      concepts: current.concepts.map((concept) => (concept.id === conceptId ? { ...concept, ...patch } : concept)),
    }))
  }

  function updateListItem<T extends ConceptIntegrationItem | ConceptBreakdownRow | ConceptReferenceRow>(
    conceptId: string,
    key: 'productIntegration' | 'breakdown' | 'references',
    itemId: string,
    patch: Partial<T>
  ) {
    setSaved(false)
    setBoard((current) => ({
      ...current,
      concepts: current.concepts.map((concept) =>
        concept.id === conceptId
          ? {
              ...concept,
              [key]: (concept[key] as T[]).map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
            }
          : concept
      ),
    }))
  }

  function addConcept() {
    setSaved(false)
    setBoard((current) => ({ ...current, concepts: [...current.concepts, createEmptyConcept()] }))
  }

  function deleteConcept(conceptId: string) {
    if (!window.confirm(t.confirmDeleteConcept)) return
    setSaved(false)
    setBoard((current) => ({ ...current, concepts: current.concepts.filter((concept) => concept.id !== conceptId) }))
  }

  async function saveBoard() {
    const nextBoard = { ...board, updatedAt: new Date().toISOString() }
    const { data, error } = await supabase
      .from('docs')
      .update({
        title: nextBoard.title || 'Concept Board',
        content: JSON.stringify(nextBoard),
      })
      .eq('id', doc.id)
      .select()
      .single()

    if (error) {
      window.alert(error.message)
      return
    }

    setBoard(nextBoard)
    setSaved(true)
    onSaved(data as CoreDoc)
  }

  async function importBriefs() {
    const files = await pickFiles('.pdf,.txt,.docx', true)
    if (files.length === 0) return
    const extracted = await Promise.all(files.map(extractBriefText))
    setBriefs((current) => [...current, ...extracted])
  }

  async function runAiReview() {
    if (!canReview || aiLoading) return
    setAiOpen(true)
    setAiText('')
    setAiLoading(true)

    try {
      const response = await fetch('/api/concept-board-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefs, concepts: board.concepts }),
      })

      if (!response.ok || !response.body) {
        const message = await response.text()
        throw new Error(message || 'AI review failed')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        setAiText((current) => current + decoder.decode(value, { stream: true }))
      }
    } catch (error) {
      setAiText(error instanceof Error ? error.message : 'AI review failed')
    } finally {
      setAiLoading(false)
    }
  }

  function exportPdf() {
    window.print()
  }

  function exportWord() {
    const html = buildWordHtml(board, t)
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${sanitizeFilename(board.project || board.title || 'concept-board')}.doc`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const created = formatDate(board.createdAt || doc.created_at)
  const updated = formatDate(board.updatedAt || doc.created_at)

  return (
    <section className="concept-board-page">
      <header className="brief-toolbar invoice-toolbar concept-toolbar soon-no-print">
        <button type="button" onClick={onBack}>{t.back}</button>
        <div className="brief-language-toggle">
          {(['zh', 'en'] as ConceptBoardLanguage[]).map((language) => (
            <button key={language} type="button" className={board.language === language ? 'active' : ''} onClick={() => setLanguage(language)}>
              {language === 'zh' ? t.chinese : t.english}
            </button>
          ))}
        </div>
        <span className="toolbar-spacer" />
        <button className="concept-brief-button" type="button" onClick={() => void importBriefs()}>{t.importBrief}</button>
        {briefs.length > 0 && <span className="concept-brief-badge">{t.briefUploaded(briefs.length)}</span>}
        <span className="toolbar-spacer" />
        <button className="concept-ai-button" type="button" disabled={!canReview || aiLoading} onClick={() => void runAiReview()}>{t.ai}</button>
        <button className="export-button export-pdf-button" type="button" onClick={exportPdf}>{t.pdf}</button>
        <button className="export-button export-word-button" type="button" onClick={exportWord}>{t.word}</button>
        <button className="primary-button" type="button" onClick={() => void saveBoard()}>{t.save}</button>
        {saved && <span className="saved-indicator">{t.saved}</span>}
      </header>

      <article className="concept-document soon-print-doc">
        <input className="concept-doc-title" value={board.title} onChange={(event) => updateBoard({ title: event.target.value })} />
        <p className="concept-meta">{t.meta(created, updated)}</p>

        <div className="concept-header-fields">
          <label><span>{t.client}</span><input value={board.client} onChange={(event) => updateBoard({ client: event.target.value })} /></label>
          <label><span>{t.project}</span><input value={board.project} onChange={(event) => updateBoard({ project: event.target.value })} /></label>
        </div>

        {board.concepts.map((concept, index) => (
          <ConceptBlock
            key={concept.id}
            concept={concept}
            index={index}
            language={board.language}
            copy={t}
            canDelete={board.concepts.length > 1}
            onDelete={() => deleteConcept(concept.id)}
            onUpdate={(patch) => updateConcept(concept.id, patch)}
            onUpdateItem={updateListItem}
          />
        ))}

        <button className="concept-add-button soon-no-print" type="button" onClick={addConcept}>{t.addConcept}</button>
      </article>

      {aiOpen && (
        <aside className="ai-review-panel soon-no-print">
          <header>
            <h2>{t.aiTitle}</h2>
            <button type="button" onClick={() => setAiOpen(false)}>×</button>
          </header>
          <div className="ai-review-body">
            {aiLoading && !aiText && <p>Loading...</p>}
            <pre>{aiText}</pre>
          </div>
        </aside>
      )}
    </section>
  )
}

function ConceptBlock({
  concept,
  index,
  language,
  copy,
  canDelete,
  onDelete,
  onUpdate,
  onUpdateItem,
}: {
  concept: ConceptSection
  index: number
  language: ConceptBoardLanguage
  copy: (typeof conceptCopy)[ConceptBoardLanguage]
  canDelete: boolean
  onDelete: () => void
  onUpdate: (patch: Partial<ConceptSection>) => void
  onUpdateItem: <T extends ConceptIntegrationItem | ConceptBreakdownRow | ConceptReferenceRow>(
    conceptId: string,
    key: 'productIntegration' | 'breakdown' | 'references',
    itemId: string,
    patch: Partial<T>
  ) => void
}) {
  const conceptLabel = `Concept ${String(index + 1).padStart(2, '0')}`

  function addProductItem() {
    onUpdate({ productIntegration: [...concept.productIntegration, { id: makeLocalId(), text: '' }] })
  }

  function removeProductItem(id: string) {
    onUpdate({ productIntegration: concept.productIntegration.filter((item) => item.id !== id) })
  }

  function addBreakdownRow() {
    onUpdate({ breakdown: [...concept.breakdown, { id: makeLocalId(), name: '', description: '', time: '', images: [] }] })
  }

  function removeBreakdownRow(id: string) {
    onUpdate({ breakdown: concept.breakdown.filter((row) => row.id !== id) })
  }

  function addReferenceRow() {
    onUpdate({ references: [...concept.references, { id: makeLocalId(), image: '', title: '', views: '', date: '', url: '', description: '' }] })
  }

  function removeReferenceRow(id: string) {
    onUpdate({ references: concept.references.filter((row) => row.id !== id) })
  }

  async function uploadCover() {
    const [file] = await pickFiles('image/*', false)
    if (!file) return
    onUpdate({ coverImage: await fileToDataUrl(file) })
  }

  async function uploadBreakdownImages(row: ConceptBreakdownRow) {
    const files = await pickFiles('image/*', true)
    if (files.length === 0) return
    const images = await Promise.all(files.map(fileToDataUrl))
    onUpdateItem<ConceptBreakdownRow>(concept.id, 'breakdown', row.id, { images: [...row.images, ...images] })
  }

  async function uploadReferenceImage(row: ConceptReferenceRow) {
    const [file] = await pickFiles('image/*', false)
    if (!file) return
    onUpdateItem<ConceptReferenceRow>(concept.id, 'references', row.id, { image: await fileToDataUrl(file) })
  }

  return (
    <section className="concept-section">
      <header className="concept-section-header">
        <div>
          <strong>{conceptLabel}</strong>
          <span className="concept-accent-line" />
        </div>
        {canDelete && <button className="danger-text-button soon-no-print" type="button" onClick={onDelete}>{copy.deleteConcept}</button>}
      </header>

      <section className="concept-field-section">
        <h2>{copy.cover}</h2>
        <button className="concept-upload-zone soon-no-print" type="button" onClick={() => void uploadCover()}>
          {concept.coverImage ? <img src={concept.coverImage} alt="" /> : <span>{copy.uploadCover}</span>}
          {concept.coverImage && <small>{copy.replaceImage}</small>}
        </button>
        {concept.coverImage && <img className="concept-print-cover" src={concept.coverImage} alt="" />}
      </section>

      <section className="concept-field-section">
        <h2>{copy.titleLabel}</h2>
        <input className="concept-title-input" value={concept.title} placeholder={copy.titlePlaceholder} onChange={(event) => onUpdate({ title: event.target.value })} />
      </section>

      <section className="concept-field-section">
        <h2>{copy.subtitle}</h2>
        <input className="concept-subtitle-input" value={concept.subtitle} placeholder={copy.subtitlePlaceholder} onChange={(event) => onUpdate({ subtitle: event.target.value })} />
      </section>

      <section className="concept-field-section">
        <h2>{copy.productIntegration}</h2>
        <ol className="concept-numbered-list">
          {concept.productIntegration.map((item) => (
            <li key={item.id}>
              <input value={item.text} onChange={(event) => onUpdateItem<ConceptIntegrationItem>(concept.id, 'productIntegration', item.id, { text: event.target.value })} />
              <button className="danger-text-button soon-no-print" type="button" onClick={() => removeProductItem(item.id)}>×</button>
            </li>
          ))}
        </ol>
        <button className="add-row-button soon-no-print" type="button" onClick={addProductItem}>{copy.addItem}</button>
      </section>

      <section className="concept-field-section">
        <h2>{copy.breakdown}</h2>
        <div className="concept-breakdown-list">
          {concept.breakdown.map((row) => (
            <div key={row.id} className="concept-breakdown-row">
              <input value={row.name} placeholder={copy.segmentName} onChange={(event) => onUpdateItem<ConceptBreakdownRow>(concept.id, 'breakdown', row.id, { name: event.target.value })} />
              <textarea value={row.description} placeholder={copy.segmentDescription} onChange={(event) => onUpdateItem<ConceptBreakdownRow>(concept.id, 'breakdown', row.id, { description: event.target.value })} />
              <input value={row.time} placeholder={copy.segmentTime} onChange={(event) => onUpdateItem<ConceptBreakdownRow>(concept.id, 'breakdown', row.id, { time: event.target.value })} />
              <button className="mini-upload-button soon-no-print" type="button" onClick={() => void uploadBreakdownImages(row)}>{copy.addImage}</button>
              <div className="concept-thumbs">
                {row.images.map((image, imageIndex) => (
                  <button key={image} type="button" onClick={() => onUpdateItem<ConceptBreakdownRow>(concept.id, 'breakdown', row.id, { images: row.images.filter((_, currentIndex) => currentIndex !== imageIndex) })}>
                    <img src={image} alt="" />
                  </button>
                ))}
              </div>
              <button className="danger-text-button soon-no-print" type="button" onClick={() => removeBreakdownRow(row.id)}>×</button>
            </div>
          ))}
        </div>
        <button className="add-row-button soon-no-print" type="button" onClick={addBreakdownRow}>{copy.addSegment}</button>
      </section>

      <section className="concept-field-section">
        <h2>{copy.pastReferences}</h2>
        <div className="concept-reference-list">
          {concept.references.map((row) => (
            <div key={row.id} className="concept-reference-row">
              <button className="reference-thumb soon-no-print" type="button" onClick={() => void uploadReferenceImage(row)}>
                {row.image ? <img src={row.image} alt="" /> : <span>＋</span>}
              </button>
              {row.image && <img className="reference-print-thumb" src={row.image} alt="" />}
              <input value={row.title} placeholder={copy.titleLabel} onChange={(event) => onUpdateItem<ConceptReferenceRow>(concept.id, 'references', row.id, { title: event.target.value })} />
              <input value={row.views} placeholder={copy.views} onChange={(event) => onUpdateItem<ConceptReferenceRow>(concept.id, 'references', row.id, { views: event.target.value })} />
              <input value={row.date} placeholder={copy.airDate} onChange={(event) => onUpdateItem<ConceptReferenceRow>(concept.id, 'references', row.id, { date: event.target.value })} />
              <input value={row.url} placeholder={copy.link} onChange={(event) => onUpdateItem<ConceptReferenceRow>(concept.id, 'references', row.id, { url: event.target.value })} />
              <textarea value={row.description} placeholder={copy.description} onChange={(event) => onUpdateItem<ConceptReferenceRow>(concept.id, 'references', row.id, { description: event.target.value })} />
              <button className="danger-text-button soon-no-print" type="button" onClick={() => removeReferenceRow(row.id)}>×</button>
            </div>
          ))}
        </div>
        <button className="add-row-button soon-no-print" type="button" onClick={addReferenceRow}>{copy.addReference}</button>
      </section>
    </section>
  )
}

function getStoredLanguage(): ConceptBoardLanguage {
  if (typeof window === 'undefined') return 'zh'
  return window.localStorage.getItem(conceptBoardLangStorageKey) === 'en' ? 'en' : 'zh'
}

function makeLocalId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.click()
  })
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function extractBriefText(file: File): Promise<ClientBrief> {
  try {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension === 'txt') return { name: file.name, content: await file.text() }
    if (extension === 'pdf') return { name: file.name, content: await extractPdfText(file) }
    if (extension === 'docx') return { name: file.name, content: await extractDocxText(file) }
    return { name: file.name, content: await file.text() }
  } catch (error) {
    return { name: file.name, content: `無法讀取內容：${error instanceof Error ? error.message : 'unknown error'}` }
  }
}

async function extractPdfText(file: File) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js')
  const pdfWindow = window as PdfWindow
  if (!pdfWindow.pdfjsLib) throw new Error('pdf.js not loaded')
  pdfWindow.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'
  const buffer = await file.arrayBuffer()
  const pdf = await pdfWindow.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => item.str ?? '').join(' '))
  }
  return pages.join('\n\n')
}

async function extractDocxText(file: File) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.9.0/mammoth.browser.min.js')
  const mammoth = (window as PdfWindow).mammoth
  if (!mammoth) throw new Error('mammoth.js not loaded')
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return result.value
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-HK')
}

function sanitizeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').toLowerCase() || 'concept-board'
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char)
}

function buildWordHtml(board: ConceptBoardContent, t: (typeof conceptCopy)[ConceptBoardLanguage]) {
  const concepts = board.concepts
    .map((concept, index) => {
      const integrations = concept.productIntegration.map((item) => `<li>${escapeHtml(item.text)}</li>`).join('')
      const breakdown = concept.breakdown
        .map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.description).replaceAll('\n', '<br>')}</td><td>${escapeHtml(row.time)}</td></tr>`)
        .join('')
      const refs = concept.references
        .map((row) => `<tr><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.views)}</td><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.url)}</td><td>${escapeHtml(row.description).replaceAll('\n', '<br>')}</td></tr>`)
        .join('')
      return `<section>
        <h2>Concept ${String(index + 1).padStart(2, '0')}</h2>
        ${concept.coverImage ? `<img src="${concept.coverImage}" style="max-width:100%;max-height:220px;object-fit:cover">` : ''}
        <h3>${escapeHtml(t.titleLabel)}</h3><p>${escapeHtml(concept.title)}</p>
        <h3>${escapeHtml(t.subtitle)}</h3><p>${escapeHtml(concept.subtitle)}</p>
        <h3>${escapeHtml(t.productIntegration)}</h3><ol>${integrations}</ol>
        <h3>${escapeHtml(t.breakdown)}</h3><table><tr><th>${escapeHtml(t.segmentName)}</th><th>${escapeHtml(t.segmentDescription)}</th><th>${escapeHtml(t.segmentTime)}</th></tr>${breakdown}</table>
        <h3>${escapeHtml(t.pastReferences)}</h3><table><tr><th>${escapeHtml(t.titleLabel)}</th><th>${escapeHtml(t.views)}</th><th>${escapeHtml(t.airDate)}</th><th>${escapeHtml(t.link)}</th><th>${escapeHtml(t.description)}</th></tr>${refs}</table>
      </section>`
    })
    .join('')

  return `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a}h1{font-size:28px}h2{border-left:4px solid #06b6d4;padding-left:10px;margin-top:36px}h3{font-size:14px;margin-top:18px}p,li,td,th{font-size:13px;line-height:1.7}table{border-collapse:collapse;width:100%;margin:12px 0 24px}td,th{border:1px solid #e5e5e5;padding:8px;text-align:left}.meta{color:#888;font-size:12px;margin-bottom:24px}</style></head><body><h1>${escapeHtml(board.title)}</h1><div class="meta">${escapeHtml(t.meta(formatDate(board.createdAt), formatDate(board.updatedAt)))}</div><p><strong>${escapeHtml(t.client)}:</strong> ${escapeHtml(board.client)}<br><strong>${escapeHtml(t.project)}:</strong> ${escapeHtml(board.project)}</p>${concepts}</body></html>`
}
