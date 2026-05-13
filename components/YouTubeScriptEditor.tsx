'use client'

import { useEffect, useState } from 'react'

import {
  blockTypeColors,
  blockTypeOptions,
  createEmptyBlock,
  createEmptySegment,
  parseYouTubeScript,
  segmentTypeColors,
  segmentTypeOptions,
  youtubeScriptLangStorageKey,
  type BlockType,
  type ScriptBlock,
  type ScriptSegment,
  type SegmentType,
  type YouTubeScriptContent,
  type YouTubeScriptLanguage,
} from '@/lib/youtube-script'
import { supabase } from '@/lib/supabase'
import type { CoreDoc } from '@/lib/types'

type Props = {
  doc: CoreDoc
  onBack: () => void
  onSaved: (doc: CoreDoc) => void
}

type SegmentReviewBlock = {
  block_index: number
  type: string
  issue: string | null
  suggestion: string | null
}

type SegmentReview = {
  overall?: string
  score?: number
  blocks?: SegmentReviewBlock[]
  clarity?: string
  typos?: string | null
}

const scriptCopy = {
  zh: {
    back: '← 文件中心',
    chinese: '中文',
    english: 'English',
    pdf: '匯出 PDF',
    word: '匯出 Word',
    save: 'Save',
    saved: '已儲存',
    meta: (updated: string) => `建立者 Tommy · 出片日期 · 最近更新 ${updated}`,
    releaseDate: '出片日期',
    creator: '創作者',
    guest: '嘉賓',
    location: '拍攝地方',
    series: '欄目',
    format: '形式',
    cover: '封面參考',
    uploadCover: '點擊或拖拽上傳封面參考圖',
    scriptTitle: '題目',
    addSegment: '+ 新增段落',
    deleteSegment: '刪除段落',
    confirmDeleteSegment: '確定刪除此段落？',
    addBlock: '+ 新增 Block',
    speaker: '主持：',
    segmentTypes: {
      Statement: '命題',
      Bridge: '橋段',
      Info: '資訊',
      Challenge: '挑戰',
      Experiment: '實驗',
      Ending: '結尾',
      Others: '其他',
    },
    blockTypes: {
      camera: '對鏡頭',
      vo: '旁白',
      visual: '畫面描述',
      behind: '幕後對話',
      insert: 'Insert 提示',
      other: '其他',
    },
  },
  en: {
    back: '← Docs Center',
    chinese: '中文',
    english: 'English',
    pdf: 'Export PDF',
    word: 'Export Word',
    save: 'Save',
    saved: 'Saved',
    meta: (updated: string) => `Created by Tommy · Release date · Last updated ${updated}`,
    releaseDate: 'Release Date',
    creator: 'Creator',
    guest: 'Guest',
    location: 'Shoot Location',
    series: 'Series',
    format: 'Format',
    cover: 'Cover Reference',
    uploadCover: 'Click or drag to upload cover reference',
    scriptTitle: 'Script Title',
    addSegment: '+ Add Segment',
    deleteSegment: 'Delete Segment',
    confirmDeleteSegment: 'Delete this segment?',
    addBlock: '+ Add Block',
    speaker: 'Speaker:',
    segmentTypes: {
      Statement: 'Statement',
      Bridge: 'Bridge',
      Info: 'Info',
      Challenge: 'Challenge',
      Experiment: 'Experiment',
      Ending: 'Ending',
      Others: 'Others',
    },
    blockTypes: {
      camera: 'On Camera',
      vo: 'VO',
      visual: 'Visual Description',
      behind: 'Behind-the-scenes Dialogue',
      insert: 'Insert Prompt',
      other: 'Other',
    },
  },
} as const

const blockPlaceholders: Record<BlockType, string> = {
  camera: '👉「...」',
  vo: 'VO：...',
  visual: '（畫面：...）',
  behind: '幕後：「...」',
  insert: 'Insert ...',
  other: '...',
}

export function YouTubeScriptEditor({ doc, onBack, onSaved }: Props) {
  const [script, setScript] = useState<YouTubeScriptContent>(() => parseYouTubeScript(doc.content, getStoredLanguage()))
  const [logoBase64, setLogoBase64] = useState('')
  const [companyName, setCompanyName] = useState('SOON Studio')
  const [saved, setSaved] = useState(false)
  const [draggedSegmentId, setDraggedSegmentId] = useState<string | null>(null)
  const [draggedBlock, setDraggedBlock] = useState<{ segmentId: string; blockId: string } | null>(null)
  const [segmentReviews, setSegmentReviews] = useState<Record<string, SegmentReview>>({})
  const [reviewingSegmentId, setReviewingSegmentId] = useState<string | null>(null)
  const [editingBlockTypeIds, setEditingBlockTypeIds] = useState<string[]>([])
  const [hiddenAiCommentKeys, setHiddenAiCommentKeys] = useState<string[]>([])
  const t = scriptCopy[script.language]

  useEffect(() => {
    void loadSettings()
  }, [])

  useEffect(() => {
    function closeTypeSelectors() {
      setEditingBlockTypeIds([])
    }

    document.addEventListener('click', closeTypeSelectors)
    return () => document.removeEventListener('click', closeTypeSelectors)
  }, [])

  async function loadSettings() {
    const { data } = await supabase
      .from('settings')
      .select('logo_base64, company_name')
      .eq('user_id', 'tommy')
      .maybeSingle()
    setLogoBase64(String(data?.logo_base64 ?? ''))
    setCompanyName(String(data?.company_name ?? 'SOON Studio'))
  }

  function updateScript(patch: Partial<YouTubeScriptContent>) {
    setSaved(false)
    setScript((current) => ({ ...current, ...patch }))
  }

  function setLanguage(language: YouTubeScriptLanguage) {
    window.localStorage.setItem(youtubeScriptLangStorageKey, language)
    updateScript({ language })
  }

  function updateSegment(segmentId: string, patch: Partial<ScriptSegment>) {
    setSaved(false)
    setScript((current) => ({
      ...current,
      segments: current.segments.map((segment) => (segment.id === segmentId ? { ...segment, ...patch } : segment)),
    }))
  }

  function updateBlock(segmentId: string, blockId: string, patch: Partial<ScriptBlock>) {
    setSaved(false)
    setScript((current) => ({
      ...current,
      segments: current.segments.map((segment) =>
        segment.id === segmentId
          ? {
              ...segment,
              blocks: segment.blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)),
            }
          : segment
      ),
    }))
  }

  function addSegment() {
    updateScript({ segments: [...script.segments, createEmptySegment()] })
  }

  function deleteSegment(segmentId: string) {
    if (!window.confirm(t.confirmDeleteSegment)) return
    updateScript({ segments: script.segments.filter((segment) => segment.id !== segmentId) })
  }

  function addBlock(segmentId: string) {
    const segment = script.segments.find((item) => item.id === segmentId)
    if (!segment) return
    updateSegment(segmentId, { blocks: [...segment.blocks, createEmptyBlock()] })
  }

  function deleteBlock(segmentId: string, blockId: string) {
    const segment = script.segments.find((item) => item.id === segmentId)
    if (!segment) return
    updateSegment(segmentId, { blocks: segment.blocks.filter((block) => block.id !== blockId) })
  }

  function moveSegment(targetSegmentId: string) {
    if (!draggedSegmentId || draggedSegmentId === targetSegmentId) return
    const current = [...script.segments]
    const from = current.findIndex((segment) => segment.id === draggedSegmentId)
    const to = current.findIndex((segment) => segment.id === targetSegmentId)
    if (from < 0 || to < 0) return
    const [item] = current.splice(from, 1)
    current.splice(to, 0, item)
    updateScript({ segments: current })
    setDraggedSegmentId(null)
  }

  function moveBlock(targetSegmentId: string, targetBlockId: string) {
    if (!draggedBlock || draggedBlock.segmentId !== targetSegmentId || draggedBlock.blockId === targetBlockId) return
    const segment = script.segments.find((item) => item.id === targetSegmentId)
    if (!segment) return
    const blocks = [...segment.blocks]
    const from = blocks.findIndex((block) => block.id === draggedBlock.blockId)
    const to = blocks.findIndex((block) => block.id === targetBlockId)
    if (from < 0 || to < 0) return
    const [item] = blocks.splice(from, 1)
    blocks.splice(to, 0, item)
    updateSegment(targetSegmentId, { blocks })
    setDraggedBlock(null)
  }

  async function uploadCover() {
    const [file] = await pickFiles('image/*')
    if (!file) return
    updateScript({ coverImage: await fileToDataUrl(file) })
  }

  async function saveScript() {
    const nextScript = { ...script, updatedAt: new Date().toISOString() }
    const { data, error } = await supabase
      .from('docs')
      .update({ title: nextScript.title || 'YouTube Script', content: JSON.stringify(nextScript) })
      .eq('id', doc.id)
      .select()
      .single()
    if (error) {
      window.alert(error.message)
      return
    }
    setScript(nextScript)
    setSaved(true)
    onSaved(data as CoreDoc)
  }

  async function reviewSegment(segment: ScriptSegment) {
    if (reviewingSegmentId) return
    setReviewingSegmentId(segment.id)
    setHiddenAiCommentKeys((current) => current.filter((key) => !key.startsWith(`${segment.id}:`)))

    try {
      const response = await fetch('/api/youtube-script-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentType: segment.type,
          segmentTypeLabel: t.segmentTypes[segment.type],
          segmentTitle: segment.title,
          blocks: segment.blocks.map((block) => ({
            type: block.type ?? 'other',
            typeLabel: block.type ? t.blockTypes[block.type] : '未選類型',
            speaker: block.speaker,
            content: block.content,
          })),
        }),
      })
      const data = (await response.json()) as SegmentReview & { error?: string }
      if (!response.ok || data.error) throw new Error(data.error || 'AI review failed')
      setSegmentReviews((current) => ({ ...current, [segment.id]: data }))
    } catch (error) {
      setSegmentReviews((current) => ({
        ...current,
        [segment.id]: {
          score: 0,
          blocks: [],
          clarity: error instanceof Error ? error.message : 'AI review failed',
          typos: null,
        },
      }))
    } finally {
      setReviewingSegmentId(null)
    }
  }

  function clearSegmentReview(segmentId: string) {
    setSegmentReviews((current) => {
      const next = { ...current }
      delete next[segmentId]
      return next
    })
    setHiddenAiCommentKeys((current) => current.filter((key) => !key.startsWith(`${segmentId}:`)))
  }

  function openBlockTypeSelector(blockId: string) {
    setEditingBlockTypeIds((current) => (current.includes(blockId) ? current : [...current, blockId]))
  }

  function closeBlockTypeSelector(blockId: string) {
    setEditingBlockTypeIds((current) => current.filter((id) => id !== blockId))
  }

  function hideAiComment(commentKey: string) {
    setHiddenAiCommentKeys((current) => (current.includes(commentKey) ? current : [...current, commentKey]))
  }

  function exportPdf() {
    window.print()
  }

  function exportWord() {
    const html = buildWordHtml(script, t)
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${sanitizeFilename(script.scriptTitle || script.title || 'youtube-script')}.doc`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="script-editor-page">
      <header className="brief-toolbar invoice-toolbar script-toolbar soon-no-print">
        <button type="button" onClick={onBack}>{t.back}</button>
        <div className="brief-language-toggle">
          {(['zh', 'en'] as YouTubeScriptLanguage[]).map((language) => (
            <button key={language} type="button" className={script.language === language ? 'active' : ''} onClick={() => setLanguage(language)}>
              {language === 'zh' ? t.chinese : t.english}
            </button>
          ))}
        </div>
        <span className="toolbar-spacer" />
        <button className="export-button export-pdf-button" type="button" onClick={exportPdf}>{t.pdf}</button>
        <button className="export-button export-word-button" type="button" onClick={exportWord}>{t.word}</button>
        <button className="primary-button" type="button" onClick={() => void saveScript()}>{t.save}</button>
        {saved && <span className="saved-indicator">{t.saved}</span>}
      </header>

      <article className="script-document soon-print-doc">
        <div className="doc-logo-area">
          {logoBase64 ? <img src={logoBase64} alt="" /> : <span>{companyName}</span>}
        </div>
        <input className="script-doc-title" value={script.title} onChange={(event) => updateScript({ title: event.target.value })} />
        <p className="script-meta">{t.meta(formatDate(script.updatedAt))}</p>

        <table className="script-info-table">
          <tbody>
            <tr>
              <th>{t.releaseDate}</th>
              <td><input type="date" value={script.releaseDate} onChange={(event) => updateScript({ releaseDate: event.target.value })} /></td>
              <th>{t.creator}</th>
              <td><input value={script.creator} onChange={(event) => updateScript({ creator: event.target.value })} /></td>
            </tr>
            <tr>
              <th>{t.guest}</th>
              <td><input value={script.guest} onChange={(event) => updateScript({ guest: event.target.value })} /></td>
              <th>{t.location}</th>
              <td><input value={script.location} onChange={(event) => updateScript({ location: event.target.value })} /></td>
            </tr>
            <tr>
              <th>{t.series}</th>
              <td><input value={script.series} onChange={(event) => updateScript({ series: event.target.value })} /></td>
              <th>{t.format}</th>
              <td><input value={script.format} onChange={(event) => updateScript({ format: event.target.value })} /></td>
            </tr>
          </tbody>
        </table>

        <section className="script-field-section">
          <h2>{t.cover}</h2>
          <button className="script-upload-zone soon-no-print" type="button" onClick={() => void uploadCover()}>
            {script.coverImage ? <img src={script.coverImage} alt="" /> : <span>{t.uploadCover}</span>}
          </button>
          {script.coverImage && <img className="script-print-cover" src={script.coverImage} alt="" />}
        </section>

        <label className="script-title-field">
          <span>{t.scriptTitle}</span>
          <input value={script.scriptTitle} placeholder="《 ... 》" onChange={(event) => updateScript({ scriptTitle: event.target.value })} />
        </label>

        <div className="script-segments">
          {script.segments.map((segment, segmentIndex) => (
            (() => {
              const review = segmentReviews[segment.id]
              const hasTypos = Boolean(review?.typos && review.typos !== 'null')
              const isReviewing = reviewingSegmentId === segment.id
              return (
            <section
              key={segment.id}
              className="script-segment"
              draggable
              onDragStart={() => setDraggedSegmentId(segment.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveSegment(segment.id)}
            >
              <header className="script-segment-header">
                <span className="drag-handle">⠿</span>
                <strong>#{String(segmentIndex + 1).padStart(2, '0')}</strong>
                <select
                  value={segment.type}
                  style={{ borderColor: segmentTypeColors[segment.type], color: segmentTypeColors[segment.type] }}
                  onChange={(event) => updateSegment(segment.id, { type: event.target.value as SegmentType })}
                >
                  {segmentTypeOptions.map((type) => (
                    <option key={type} value={type}>{t.segmentTypes[type]}</option>
                  ))}
                </select>
                {typeof review?.score === 'number' && <ScoreBadge score={review.score} />}
                {hasTypos && <span className="script-typo-badge">⚠️ 有錯字</span>}
                <input value={segment.title} placeholder="Segment title" onChange={(event) => updateSegment(segment.id, { title: event.target.value })} />
                <div className="script-segment-actions soon-no-print">
                  <button className="script-ai-review-button" type="button" disabled={isReviewing} onClick={() => void reviewSegment(segment)}>
                    {isReviewing && <span className="ai-spinner" />}
                    {isReviewing ? '分析中...' : '✨ AI 審閱'}
                  </button>
                  {review && (
                    <button className="script-clear-review-button" type="button" onClick={() => clearSegmentReview(segment.id)}>
                      清除審閱
                    </button>
                  )}
                  <button className="danger-text-button" type="button" onClick={() => deleteSegment(segment.id)}>{t.deleteSegment}</button>
                </div>
              </header>

              <div className="script-blocks">
                {segment.blocks.map((block, blockIndex) => {
                  const blockReview = review?.blocks?.find((item) => item.block_index === blockIndex)
                  const commentKey = `${segment.id}:${blockIndex}`
                  const selectedBlockType = block.type
                  const blockColor = selectedBlockType ? blockTypeColors[selectedBlockType] : '#d1d5db'
                  const isEditingType = editingBlockTypeIds.includes(block.id)
                  const showAllBlockTypes = !selectedBlockType || isEditingType
                  return (
                  <div
                    key={block.id}
                    className="script-block"
                    draggable
                    style={{ borderLeftColor: blockColor, background: selectedBlockType ? hexToRgba(blockColor, 0.04) : '#fafafa' }}
                    onDragStart={(event) => {
                      event.stopPropagation()
                      setDraggedBlock({ segmentId: segment.id, blockId: block.id })
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.stopPropagation()
                      moveBlock(segment.id, block.id)
                    }}
                  >
                    <button className="script-block-delete soon-no-print" type="button" onClick={() => deleteBlock(segment.id, block.id)}>×</button>
                    <div className="script-block-types" onClick={(event) => event.stopPropagation()}>
                      {showAllBlockTypes ? (
                        blockTypeOptions.map((type) => {
                          const active = selectedBlockType === type
                          return (
                            <button
                              key={type}
                              type="button"
                              style={{ background: active ? blockTypeColors[type] : 'transparent', color: active ? '#fff' : blockTypeColors[type], borderColor: blockTypeColors[type] }}
                              onClick={() => {
                                updateBlock(segment.id, block.id, { type })
                                closeBlockTypeSelector(block.id)
                              }}
                            >
                              {t.blockTypes[type]}
                            </button>
                          )
                        })
                      ) : (
                        <button
                          className="script-selected-block-type"
                          type="button"
                          style={{ background: blockColor, borderColor: blockColor }}
                          onClick={(event) => {
                            event.stopPropagation()
                            openBlockTypeSelector(block.id)
                          }}
                        >
                          {t.blockTypes[selectedBlockType]}
                          <span>▾</span>
                        </button>
                      )}
                    </div>
                    {(block.type === 'camera' || block.type === 'behind') && (
                      <input className="script-speaker-input" value={block.speaker} placeholder={t.speaker} onChange={(event) => updateBlock(segment.id, block.id, { speaker: event.target.value })} />
                    )}
                    <textarea
                      value={block.content}
                      placeholder={block.type ? blockPlaceholders[block.type] : '...'}
                      rows={3}
                      onChange={(event) => {
                        autoResize(event.currentTarget)
                        updateBlock(segment.id, block.id, { content: event.target.value })
                      }}
                    />
                    <div className="print-text">{block.content}</div>
                    <ScriptAiCommentBox
                      comment={hiddenAiCommentKeys.includes(commentKey) ? undefined : blockReview}
                      onApply={(value) => updateBlock(segment.id, block.id, { content: value })}
                      onClose={() => hideAiComment(commentKey)}
                    />
                  </div>
                )})}
              </div>
              {review?.clarity && <div className="script-clarity-card">{review.clarity}</div>}
              <button className="add-row-button soon-no-print" type="button" onClick={() => addBlock(segment.id)}>{t.addBlock}</button>
            </section>
              )
            })()
          ))}
        </div>

        <button className="script-add-segment soon-no-print" type="button" onClick={addSegment}>{t.addSegment}</button>
      </article>
    </section>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const background = score >= 8 ? '#22c55e' : score >= 6 ? '#f59e0b' : '#ef4444'
  return <span className="script-score-badge" style={{ background }}>{score}/10</span>
}

function ScriptAiCommentBox({
  comment,
  onApply,
  onClose,
}: {
  comment?: SegmentReviewBlock
  onApply: (value: string) => void
  onClose: () => void
}) {
  if (!comment?.issue && !comment?.suggestion) return null
  return (
    <div className="ai-comment-box script-ai-comment-box">
      <button className="ai-comment-close" type="button" aria-label="Close comment" onClick={onClose}>
        ×
      </button>
      {comment.issue && <p className="ai-comment-issue">⚠️ {comment.issue}</p>}
      {comment.suggestion && <p className="ai-comment-suggestion">💡 建議：{comment.suggestion}</p>}
      {comment.suggestion && (
        <button type="button" onClick={() => onApply(comment.suggestion ?? '')}>
          採用建議
        </button>
      )}
    </div>
  )
}

function getStoredLanguage(): YouTubeScriptLanguage {
  if (typeof window === 'undefined') return 'zh'
  return window.localStorage.getItem(youtubeScriptLangStorageKey) === 'en' ? 'en' : 'zh'
}

function autoResize(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight}px`
}

function pickFiles(accept: string): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-HK')
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function sanitizeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').toLowerCase() || 'youtube-script'
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char)
}

function buildWordHtml(script: YouTubeScriptContent, t: (typeof scriptCopy)[YouTubeScriptLanguage]) {
  const segments = script.segments
    .map((segment, segmentIndex) => {
      const blocks = segment.blocks
        .map(
          (block) => {
            const blockType = block.type ?? 'other'
            return `<div style="border-left:3px solid ${blockTypeColors[blockType]};padding:8px 12px;margin:8px 0;background:#fafafa"><strong>${escapeHtml(t.blockTypes[blockType])}${block.speaker ? ` · ${escapeHtml(block.speaker)}` : ''}</strong><p>${escapeHtml(block.content).replaceAll('\n', '<br>')}</p></div>`
          }
        )
        .join('')
      return `<section><h2>#${String(segmentIndex + 1).padStart(2, '0')} ${escapeHtml(t.segmentTypes[segment.type])} · ${escapeHtml(segment.title)}</h2>${blocks}</section>`
    })
    .join('')

  return `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a}h1{font-size:28px}table{border-collapse:collapse;width:100%;margin:18px 0}td,th{border:1px solid #e5e5e5;padding:8px 12px;font-size:13px;text-align:left}th{width:120px;background:#f9f9f9}p{font-size:13px;line-height:1.8}</style></head><body><h1>${escapeHtml(script.title)}</h1><p>${escapeHtml(t.meta(formatDate(script.updatedAt)))}</p><table><tr><th>${t.releaseDate}</th><td>${script.releaseDate}</td><th>${t.creator}</th><td>${escapeHtml(script.creator)}</td></tr><tr><th>${t.guest}</th><td>${escapeHtml(script.guest)}</td><th>${t.location}</th><td>${escapeHtml(script.location)}</td></tr><tr><th>${t.series}</th><td>${escapeHtml(script.series)}</td><th>${t.format}</th><td>${escapeHtml(script.format)}</td></tr></table>${script.coverImage ? `<img src="${script.coverImage}" style="max-width:100%;max-height:220px">` : ''}<h1>《${escapeHtml(script.scriptTitle)}》</h1>${segments}</body></html>`
}
