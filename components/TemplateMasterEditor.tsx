'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, FabricImage, FabricObject, Rect, Textbox } from 'fabric'

const PAGE_ROLES = [
  { code: 'cover', label: '01 Cover', hint: '封面 Hook' },
  { code: 'longform', label: '02 Longform', hint: '長文內容' },
  { code: 'split', label: '03 Split', hint: '左右分割' },
  { code: 'comparison', label: '04 Comparison', hint: '對比資訊' },
  { code: 'feature', label: '05 Feature', hint: '重點特色' },
  { code: 'end', label: '06 End', hint: '總結／CTA' },
] as const

type PageRole = (typeof PAGE_ROLES)[number]['code']
type PageDesign = {
  canvasJson?: Record<string, unknown>
  canvasWidth?: number
  canvasHeight?: number
  updatedAt?: string
}
type MasterPayload = {
  draft: {
    id: string
    targetVersion: number
    status: string
    pageDesigns: Partial<Record<PageRole, PageDesign>>
    changeSummary: string
    updatedAt: string
  }
  style: { code: string; name: string }
  template: { code: string; name: string; description: string; format: string }
  baseVersion: {
    number: number
    rendererCode: string
    contentHash: string
    contract: Record<string, unknown>
  } | null
}

type EditableObject = FabricObject & { data?: { id?: string; role?: string } }

const DISPLAY_WIDTH = 432
const DISPLAY_HEIGHT = 540
const OUTPUT_WIDTH = 1080
const OUTPUT_HEIGHT = 1350

function placeholderFor(role: PageRole) {
  const copy: Record<PageRole, { eyebrow: string; title: string; body: string }> = {
    cover: { eyebrow: 'CATEGORY · BRAND', title: '{{headline}}', body: '{{subheadline}}' },
    longform: { eyebrow: '02 · CONTEXT', title: '{{headline}}', body: '{{body}}' },
    split: { eyebrow: '03 · TWO SIDES', title: '{{headline}}', body: '{{left_body}}\n\n{{right_body}}' },
    comparison: { eyebrow: '04 · COMPARE', title: '{{headline}}', body: '{{option_a}}\nVS\n{{option_b}}' },
    feature: { eyebrow: '05 · FEATURE', title: '{{headline}}', body: '{{body}}' },
    end: { eyebrow: '06 · SUMMARY', title: '{{headline}}', body: '{{cta}}' },
  }
  return copy[role]
}

function attachData<T extends EditableObject>(object: T, role: string) {
  object.data = { id: crypto.randomUUID(), role }
  return object
}

function addStarterObjects(canvas: Canvas, role: PageRole) {
  const copy = placeholderFor(role)
  canvas.clear()
  canvas.backgroundColor = '#F4F0E8'

  const accent = attachData(new Rect({
    fill: role === 'comparison' ? '#E24B35' : '#3159C6',
    height: role === 'cover' ? 12 : 8,
    left: 30,
    rx: 4,
    ry: 4,
    top: 30,
    width: role === 'cover' ? 150 : 92,
  }) as EditableObject, 'accent')
  const eyebrow = attachData(new Textbox(copy.eyebrow, {
    fill: '#3159C6',
    fontFamily: 'Arial, sans-serif',
    fontSize: 13,
    fontWeight: 700,
    left: 30,
    letterSpacing: 60,
    top: 58,
    width: 360,
  }) as EditableObject, 'eyebrow')
  const title = attachData(new Textbox(copy.title, {
    fill: '#171717',
    fontFamily: 'Arial, sans-serif',
    fontSize: role === 'cover' ? 46 : 38,
    fontWeight: 800,
    left: 30,
    lineHeight: 1.02,
    splitByGrapheme: true,
    top: role === 'cover' ? 270 : 115,
    width: 370,
  }) as EditableObject, 'headline')
  const body = attachData(new Textbox(copy.body, {
    fill: '#303030',
    fontFamily: 'Arial, sans-serif',
    fontSize: role === 'comparison' ? 25 : 20,
    fontWeight: 400,
    left: 30,
    lineHeight: 1.35,
    splitByGrapheme: true,
    textAlign: role === 'comparison' ? 'center' : 'left',
    top: role === 'cover' ? 405 : 245,
    width: 370,
  }) as EditableObject, 'body')
  const page = attachData(new Textbox(PAGE_ROLES.findIndex((item) => item.code === role) + 1 + '/6', {
    fill: '#646464',
    fontFamily: 'Arial, sans-serif',
    fontSize: 11,
    left: 362,
    top: 508,
    width: 42,
  }) as EditableObject, 'page_number')

  canvas.add(accent, eyebrow, title, body, page)
  canvas.renderAll()
}

function objectType(object: FabricObject | null) {
  if (!object) return ''
  if (object instanceof Textbox) return '文字'
  if (object instanceof FabricImage) return '圖片'
  return '形狀'
}

export function TemplateMasterEditor({ draftId, styleCode }: { draftId: string; styleCode: string }) {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const loadingCanvasRef = useRef(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const [master, setMaster] = useState<MasterPayload | null>(null)
  const [role, setRole] = useState<PageRole>('cover')
  const [selected, setSelected] = useState<EditableObject | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [, redrawInspector] = useState(0)

  const completed = useMemo(() => Object.keys(master?.draft.pageDesigns || {}).length, [master])

  const loadMaster = useCallback(async () => {
    if (!draftId) {
      setMessage('缺少 Template draft ID，請由內容風格頁重新開啟。')
      setLoading(false)
      return
    }
    const response = await fetch(`/api/content-directions/template-drafts/${encodeURIComponent(draftId)}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(payload.error || '未能載入標準母版')
      setLoading(false)
      return
    }
    setMaster(payload)
    setLoading(false)
  }, [draftId])

  useEffect(() => { void loadMaster() }, [loadMaster])

  useEffect(() => {
    if (!canvasElementRef.current || fabricRef.current) return
    const canvas = new Canvas(canvasElementRef.current, {
      backgroundColor: '#F4F0E8',
      height: DISPLAY_HEIGHT,
      preserveObjectStacking: true,
      selection: true,
      width: DISPLAY_WIDTH,
    })
    fabricRef.current = canvas
    const select = () => {
      setSelected((canvas.getActiveObject() as EditableObject | undefined) || null)
      redrawInspector((value) => value + 1)
    }
    const changed = () => {
      if (!loadingCanvasRef.current) setDirty(true)
      redrawInspector((value) => value + 1)
    }
    canvas.on('selection:created', select)
    canvas.on('selection:updated', select)
    canvas.on('selection:cleared', () => setSelected(null))
    canvas.on('object:modified', changed)
    canvas.on('object:added', changed)
    canvas.on('object:removed', changed)
    return () => {
      canvas.dispose()
      fabricRef.current = null
    }
  }, [])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !master) return
    let cancelled = false
    void (async () => {
      loadingCanvasRef.current = true
      setSelected(null)
      const saved = master.draft.pageDesigns?.[role]?.canvasJson
      const publishedDesigns = master.baseVersion?.contract?.master_designs as Partial<Record<PageRole, PageDesign>> | undefined
      const published = publishedDesigns?.[role]?.canvasJson
      const existingDesign = saved ?? published
      if (existingDesign) {
        await canvas.loadFromJSON(existingDesign)
        if (cancelled) return
        canvas.renderAll()
      } else {
        addStarterObjects(canvas, role)
      }
      loadingCanvasRef.current = false
      setDirty(false)
    })()
    return () => { cancelled = true }
  }, [master, role])

  function chooseRole(next: PageRole) {
    if (next === role) return
    if (dirty && !window.confirm('目前標準頁有未儲存修改，仍然切換頁面？')) return
    setRole(next)
    setMessage('')
  }

  function addText() {
    const canvas = fabricRef.current
    if (!canvas) return
    const object = attachData(new Textbox('{{new_text}}', {
      fill: '#171717',
      fontFamily: 'Arial, sans-serif',
      fontSize: 30,
      fontWeight: 700,
      left: 76,
      splitByGrapheme: true,
      top: 190,
      width: 280,
    }) as EditableObject, 'custom_text')
    canvas.add(object)
    canvas.setActiveObject(object)
    canvas.renderAll()
    setSelected(object)
  }

  function addBox() {
    const canvas = fabricRef.current
    if (!canvas) return
    const object = attachData(new Rect({
      fill: '#3159C6',
      height: 92,
      left: 91,
      opacity: 0.9,
      rx: 10,
      ry: 10,
      top: 205,
      width: 250,
    }) as EditableObject, 'highlight_box')
    canvas.add(object)
    canvas.setActiveObject(object)
    canvas.renderAll()
    setSelected(object)
  }

  async function addImageFile(file: File) {
    const canvas = fabricRef.current
    if (!canvas) return
    setUploading(true)
    setMessage('')
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await fetch('/api/content-directions/upload', { method: 'POST', body: form })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.url) throw new Error(payload.error || '未能上載圖片')
      const image = await FabricImage.fromURL(payload.url, { crossOrigin: 'anonymous' }) as EditableObject
      const scale = Math.min(330 / (image.width || 1), 330 / (image.height || 1))
      image.set({ left: 51, top: 100, scaleX: scale, scaleY: scale })
      attachData(image, 'image')
      canvas.add(image)
      canvas.setActiveObject(image)
      canvas.renderAll()
      setSelected(image)
      setMessage('圖片已加入畫布。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '未能加入圖片')
    } finally {
      setUploading(false)
    }
  }

  function updateSelected(values: Record<string, unknown>) {
    const canvas = fabricRef.current
    if (!canvas || !selected) return
    selected.set(values)
    if (selected instanceof Textbox) selected.initDimensions()
    selected.setCoords()
    canvas.requestRenderAll()
    setDirty(true)
    redrawInspector((value) => value + 1)
  }

  function removeSelected() {
    const canvas = fabricRef.current
    if (!canvas || !selected) return
    canvas.remove(selected)
    canvas.discardActiveObject()
    canvas.renderAll()
    setSelected(null)
  }

  async function savePage() {
    const canvas = fabricRef.current
    if (!canvas || !master || saving) return
    setSaving(true)
    setMessage('')
    try {
      const canvasJson = canvas.toObject(['data']) as Record<string, unknown>
      const response = await fetch(`/api/content-directions/template-drafts/${encodeURIComponent(master.draft.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pageRole: role,
          canvasJson,
          canvasWidth: OUTPUT_WIDTH,
          canvasHeight: OUTPUT_HEIGHT,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || '未能儲存標準頁')
      setMaster((current) => current ? {
        ...current,
        draft: {
          ...current.draft,
          status: payload.draft.status,
          pageDesigns: payload.draft.page_designs,
          updatedAt: payload.draft.updated_at,
        },
      } : current)
      setDirty(false)
      setMessage(`${PAGE_ROLES.find((item) => item.code === role)?.label} 已儲存到 v${master.draft.targetVersion} 草稿。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '未能儲存標準頁')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="master-state">正在載入母版編輯器…</main>
  if (!master) return <main className="master-state"><p>{message || '找不到母版草稿'}</p><Link href="/content-directions">返回內容風格</Link></main>

  const selectedFill = typeof selected?.fill === 'string' ? selected.fill : '#171717'
  const selectedOpacity = Math.round((selected?.opacity ?? 1) * 100)
  const currentPage = PAGE_ROLES.find((item) => item.code === role)!

  return (
    <main className="master-editor">
      <header className="master-topbar">
        <div>
          <Link href="/content-directions">← 返回內容風格</Link>
          <small>SOON CORE · TEMPLATE MASTER</small>
          <h1>{master.style.name} <span>v{master.draft.targetVersion}</span></h1>
        </div>
        <div className="master-progress">
          <strong>{completed}/6</strong>
          <span>標準頁已完成</span>
          <i>{dirty ? '有未儲存修改' : master.draft.status === 'review' ? '草稿可供審閱' : '草稿'}</i>
        </div>
      </header>

      {message ? <div className="master-notice">{message}</div> : null}

      <div className="master-workspace">
        <aside className="master-pages">
          <small>PAGE ROLES</small>
          {PAGE_ROLES.map((page) => (
            <button className={page.code === role ? 'active' : ''} key={page.code} onClick={() => chooseRole(page.code)} type="button">
              <span>{page.label}</span>
              <small>{page.hint}</small>
              <b>{master.draft.pageDesigns?.[page.code] ? '✓' : '—'}</b>
            </button>
          ))}
        </aside>

        <section className="master-stage">
          <div className="master-toolbar">
            <div>
              <button onClick={addText} type="button">＋ 文字</button>
              <button onClick={addBox} type="button">＋ 色塊</button>
              <button disabled={uploading} onClick={() => imageInputRef.current?.click()} type="button">{uploading ? '上載中…' : '＋ 圖片'}</button>
              <input ref={imageInputRef} hidden accept="image/png,image/jpeg,image/webp" type="file" onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void addImageFile(file)
                event.target.value = ''
              }} />
            </div>
            <div>
              <button disabled={!selected} onClick={() => { if (selected) { fabricRef.current?.bringObjectForward(selected); fabricRef.current?.renderAll(); setDirty(true) } }} type="button">上一層</button>
              <button disabled={!selected} onClick={() => { if (selected) { fabricRef.current?.sendObjectBackwards(selected); fabricRef.current?.renderAll(); setDirty(true) } }} type="button">下一層</button>
              <button className="danger" disabled={!selected} onClick={removeSelected} type="button">刪除</button>
            </div>
          </div>
          <div className="master-canvas-wrap">
            <div className="master-canvas-label"><b>{currentPage.label}</b><span>1080 × 1350 · 4:5</span></div>
            <div className="master-canvas-shell"><canvas ref={canvasElementRef} /></div>
            <p>拖曳移動；拉動控制點縮放及旋轉；雙擊文字直接修改。</p>
          </div>
        </section>

        <aside className="master-inspector">
          <small>INSPECTOR</small>
          {selected ? <>
            <h2>{objectType(selected)}</h2>
            <label>用途<input value={selected.data?.role || ''} onChange={(event) => { selected.data = { ...(selected.data || {}), role: event.target.value }; setDirty(true); redrawInspector((value) => value + 1) }} /></label>
            {selected instanceof Textbox ? <>
              <label>文字<textarea rows={5} value={selected.text || ''} onChange={(event) => updateSelected({ text: event.target.value })} /></label>
              <label>字體<select value={String(selected.fontFamily || 'Arial, sans-serif')} onChange={(event) => updateSelected({ fontFamily: event.target.value })}><option value="Arial, sans-serif">系統黑體</option><option value="Georgia, serif">明體／Serif</option><option value="SweiGothicCJKtc-Regular">獅尾黑體</option><option value="GenSenRounded2">圓體</option></select></label>
              <div className="inspector-grid"><label>字號<input min="8" max="120" type="number" value={Math.round(Number(selected.fontSize || 24))} onChange={(event) => updateSelected({ fontSize: Number(event.target.value) })} /></label><label>字重<select value={String(selected.fontWeight || 400)} onChange={(event) => updateSelected({ fontWeight: Number(event.target.value) })}><option value="400">Regular</option><option value="600">Semi Bold</option><option value="700">Bold</option><option value="800">Extra Bold</option></select></label></div>
              <label>對齊<select value={String(selected.textAlign || 'left')} onChange={(event) => updateSelected({ textAlign: event.target.value })}><option value="left">左</option><option value="center">中</option><option value="right">右</option></select></label>
            </> : null}
            {!(selected instanceof FabricImage) ? <label>顏色<div className="color-control"><input type="color" value={selectedFill} onChange={(event) => updateSelected({ fill: event.target.value })} /><input value={selectedFill} onChange={(event) => updateSelected({ fill: event.target.value })} /></div></label> : null}
            <label>透明度 <b>{selectedOpacity}%</b><input min="10" max="100" type="range" value={selectedOpacity} onChange={(event) => updateSelected({ opacity: Number(event.target.value) / 100 })} /></label>
          </> : <div className="inspector-empty"><b>選擇畫布元素</b><p>點擊文字、圖片或色塊後，可在這裡調整內容與樣式。</p></div>}
          <div className="master-save">
            <button disabled={saving || !dirty} onClick={() => void savePage()} type="button">{saving ? '正在儲存…' : `儲存 ${currentPage.label}`}</button>
            <p>儲存只更新 v{master.draft.targetVersion} 草稿，不會覆蓋已發布 v{master.baseVersion?.number || 1}。</p>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .master-editor{min-height:100vh;background:#0b0b0d;color:#f6f3f8;padding:24px 28px 40px}.master-topbar{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;max-width:1500px;margin:0 auto 18px}.master-topbar a{display:block;margin-bottom:18px;color:#a78bfa;font-size:12px;text-decoration:none}.master-topbar small,.master-pages>small,.master-inspector>small{color:#a78bfa;font-size:9px;font-weight:850;letter-spacing:.16em}.master-topbar h1{margin:6px 0 0;font-size:28px}.master-topbar h1 span{color:#a78bfa}.master-progress{display:grid;grid-template-columns:auto auto;gap:2px 10px;align-items:center;border:1px solid #332742;border-radius:12px;background:#16131b;padding:12px 16px}.master-progress strong{grid-row:span 2;font-size:25px}.master-progress span{color:#aaa;font-size:10px}.master-progress i{color:#c4b5fd;font-size:9px;font-style:normal}.master-notice{max-width:1500px;margin:0 auto 14px;border:1px solid #4c3764;border-radius:10px;background:#21182b;padding:10px 14px;color:#ddd0ee;font-size:11px}.master-workspace{display:grid;grid-template-columns:190px minmax(520px,1fr) 270px;max-width:1500px;min-height:720px;margin:auto;border:1px solid #27242b;border-radius:16px;background:#121115;overflow:hidden}.master-pages{display:grid;align-content:start;gap:8px;border-right:1px solid #29252e;padding:18px 12px}.master-pages>small{margin:0 8px 6px}.master-pages button{position:relative;display:grid;gap:4px;border:1px solid #2d2931;border-radius:10px;background:#19171c;color:#ddd;padding:12px 30px 12px 12px;text-align:left}.master-pages button.active{border-color:#8b5cf6;background:#281c39}.master-pages button span{font-size:11px;font-weight:800}.master-pages button small{color:#777;font-size:9px}.master-pages button b{position:absolute;right:11px;top:50%;color:#a78bfa;transform:translateY(-50%)}.master-stage{min-width:0;background:#17151a}.master-toolbar{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #2b2830;background:#111014;padding:10px 14px}.master-toolbar>div{display:flex;gap:6px}.master-toolbar button{border:1px solid #37323d;border-radius:7px;background:#211e25;color:#ddd;padding:8px 10px;font-size:9px}.master-toolbar button:disabled{opacity:.35}.master-toolbar .danger{color:#fda4af}.master-canvas-wrap{display:grid;place-items:center;padding:20px}.master-canvas-label{display:flex;justify-content:space-between;width:432px;margin-bottom:8px;color:#8f8994;font-size:9px}.master-canvas-label b{color:#d8d3dc}.master-canvas-shell{box-shadow:0 22px 55px rgba(0,0,0,.45);line-height:0}.master-canvas-wrap>p{margin:12px 0 0;color:#777;font-size:9px}.master-inspector{position:relative;border-left:1px solid #29252e;background:#131217;padding:18px 16px}.master-inspector h2{margin:9px 0 18px;font-size:18px}.master-inspector label{display:grid;gap:6px;margin-bottom:13px;color:#999;font-size:9px}.master-inspector label>b{color:#ddd}.master-inspector input,.master-inspector textarea,.master-inspector select{width:100%;border:1px solid #34303a;border-radius:7px;background:#1c1920;color:#eee;padding:8px;font:inherit;outline:none}.master-inspector textarea{font-size:11px;resize:vertical}.master-inspector input:focus,.master-inspector textarea:focus,.master-inspector select:focus{border-color:#8b5cf6}.inspector-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.color-control{display:grid;grid-template-columns:38px 1fr;gap:7px}.color-control input[type=color]{height:34px;padding:3px}.inspector-empty{margin-top:18px;border:1px dashed #35313a;border-radius:10px;padding:18px;color:#777}.inspector-empty b{color:#bbb;font-size:11px}.inspector-empty p{font-size:9px;line-height:1.5}.master-save{position:absolute;right:16px;bottom:16px;left:16px}.master-save button{width:100%;border:0;border-radius:9px;background:#7c3aed;color:#fff;padding:11px;font-size:10px;font-weight:850}.master-save button:disabled{background:#302b35;color:#777}.master-save p{margin:8px 2px 0;color:#6f6974;font-size:8px;line-height:1.45}.master-state{min-height:70vh;display:grid;place-content:center;gap:12px;background:#0b0b0d;color:#ddd;text-align:center}.master-state a{color:#a78bfa}@media(max-width:1100px){.master-workspace{grid-template-columns:160px minmax(480px,1fr)}.master-inspector{grid-column:1/-1;min-height:310px;border-top:1px solid #29252e;border-left:0}.master-save{position:static;margin-top:20px}}@media(max-width:760px){.master-editor{padding:16px}.master-topbar{align-items:flex-start;flex-direction:column}.master-workspace{display:block}.master-pages{grid-template-columns:repeat(2,1fr);border-right:0}.master-stage{overflow:auto}.master-inspector{min-height:360px}}
      `}</style>
    </main>
  )
}
