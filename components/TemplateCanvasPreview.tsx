'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StaticCanvas } from 'fabric'

const PAGE_ROLES = [
  { code: 'cover', label: '封面' },
  { code: 'longform', label: '內容' },
  { code: 'split', label: '雙欄' },
  { code: 'comparison', label: '比較' },
  { code: 'feature', label: '重點' },
  { code: 'end', label: '結尾' },
] as const

type PageDesign = {
  canvasJson?: Record<string, unknown>
  canvasWidth?: number
  canvasHeight?: number
  coordinateWidth?: number
  coordinateHeight?: number
}

type DesignMap = Record<string, PageDesign>

function availableRoles(designs?: DesignMap | null) {
  if (!designs) return []
  return PAGE_ROLES.filter((role) => Boolean(designs[role.code]?.canvasJson))
}

function ActualCanvas({ design, label }: { design: PageDesign; label: string }) {
  const canvasElement = useRef<HTMLCanvasElement | null>(null)
  const [failed, setFailed] = useState(false)
  const width = Math.max(100, Math.round(Number(design.coordinateWidth || design.canvasWidth || 432)))
  const height = Math.max(100, Math.round(Number(design.coordinateHeight || design.canvasHeight || 540)))

  useEffect(() => {
    if (!canvasElement.current || !design.canvasJson) return
    let cancelled = false
    const canvas = new StaticCanvas(canvasElement.current, {
      height,
      renderOnAddRemove: false,
      selection: false,
      width,
    })
    setFailed(false)
    void canvas.loadFromJSON(design.canvasJson).then(() => {
      if (cancelled) return
      canvas.getObjects().forEach((object) => object.set({ evented: false, selectable: false }))
      canvas.requestRenderAll()
    }).catch(() => {
      if (!cancelled) setFailed(true)
    })
    return () => {
      cancelled = true
      canvas.dispose()
    }
  }, [design, height, width])

  if (failed) return <div className="template-preview-empty"><b>預覽載入失敗</b><span>畫布資料仍然保留</span></div>
  return <canvas aria-label={`${label}實際模板預覽`} ref={canvasElement} />
}

export function TemplateCanvasPreview({
  draftDesigns,
  draftVersion,
  legacyImage,
  name,
  publishedDesigns,
  publishedVersion,
}: {
  draftDesigns?: DesignMap | null
  draftVersion?: number | null
  legacyImage?: string | null
  name: string
  publishedDesigns?: DesignMap | null
  publishedVersion?: number | null
}) {
  const publishedRoles = useMemo(() => availableRoles(publishedDesigns), [publishedDesigns])
  const draftRoles = useMemo(() => availableRoles(draftDesigns), [draftDesigns])
  const hasPublishedPreview = publishedRoles.length > 0 || Boolean(legacyImage)
  const [source, setSource] = useState<'published' | 'draft'>(hasPublishedPreview ? 'published' : 'draft')
  const roles = source === 'published' ? publishedRoles : draftRoles
  const designs = source === 'published' ? publishedDesigns : draftDesigns
  const [role, setRole] = useState(roles[0]?.code || 'cover')

  useEffect(() => {
    const nextSource = hasPublishedPreview ? 'published' : 'draft'
    setSource(nextSource)
  }, [hasPublishedPreview])

  useEffect(() => {
    const sourceRoles = source === 'published' ? publishedRoles : draftRoles
    if (!sourceRoles.some((item) => item.code === role)) setRole(sourceRoles[0]?.code || 'cover')
  }, [draftRoles, publishedRoles, role, source])

  const design = designs?.[role]
  const hasActualTemplate = hasPublishedPreview || draftRoles.length > 0

  return <div className="template-actual-preview">
    <div className="template-preview-badges">
      {hasPublishedPreview ? <button className={source === 'published' ? 'active' : ''} onClick={() => setSource('published')} type="button">Published v{publishedVersion}</button> : null}
      {draftRoles.length ? <button className={source === 'draft' ? 'active draft' : ''} onClick={() => setSource('draft')} type="button">Draft v{draftVersion}</button> : null}
    </div>

    <div className="template-preview-stage">
      {design?.canvasJson ? <ActualCanvas design={design} label={name} /> : legacyImage ? <Image alt={`${name}目前發布版本`} fill priority={false} sizes="(max-width: 560px) 100vw, 25vw" src={legacyImage} /> : <div className="template-preview-empty"><b>未有實際母版</b><span>建立及儲存第一頁後，這裡會顯示真正輸出。</span></div>}
      <span className={`template-preview-status ${source}`}>{hasActualTemplate ? source === 'published' ? '實際發布輸出' : '修改中・未發布' : '等待建立'}</span>
    </div>

    {roles.length > 1 ? <div className="template-preview-pages" aria-label="選擇預覽頁面">
      {roles.map((item, index) => <button aria-label={item.label} className={item.code === role ? 'active' : ''} key={item.code} onClick={() => setRole(item.code)} title={item.label} type="button">{index + 1}</button>)}
    </div> : null}
  </div>
}
