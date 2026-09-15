'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Direction = Record<string, any> & { id?: string; title: string; account: string; whySave: string; reusableTemplate: string }
const today = () => new Date().toISOString().slice(0, 10)
const empty: Direction = { title: '', account: '', platform: 'Threads', postUrl: '', imageUrl: '', capturedAt: today(), publishedAt: '', kind: 'moment', eventName: '', eventDate: '', trendStage: '發布後', trendDependency: '高度', reusableWindow: '3 日', responseSpeed: '', hook: '', format: '', visualPattern: '', tone: '', cta: '', mechanism: '', whySave: '', reusableTemplate: '', industries: [], objectives: [], tags: [], risks: '', metrics: {}, metricsCapturedAt: today() }
const split = (value: string) => value.split(/[，,；;\n]/).map((item) => item.trim()).filter(Boolean)
const join = (value: unknown) => Array.isArray(value) ? value.join('，') : ''

export function ContentDirectionLab() {
  const [items, setItems] = useState<Direction[]>([])
  const [draft, setDraft] = useState<Direction>(empty)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch('/api/content-directions', { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (response.ok) setItems(payload.directions || [])
    else setMessage(payload.error || '未能載入研究庫')
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])
  const filtered = useMemo(() => items.filter((item) => (kind === 'all' || item.kind === kind) && JSON.stringify(item).toLowerCase().includes(query.toLowerCase())), [items, kind, query])
  const update = (key: string, value: unknown) => setDraft((current) => ({ ...current, [key]: value }))
  const edit = (item: Direction) => { setDraft(item); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  async function upload(file: File) {
    setUploading(true); setMessage('')
    try {
      const form = new FormData(); form.append('file', file)
      const response = await fetch('/api/content-directions/upload', { method: 'POST', body: form })
      const payload = await response.json().catch(() => ({}))
      if (response.ok) update('imageUrl', payload.url)
      else setMessage(payload.error || '未能上載截圖')
    } catch {
      setMessage('未能上載截圖，請檢查連線後再試。')
    } finally {
      setUploading(false)
    }
  }

  async function analyse() {
    if (!draft.imageUrl || !draft.account.trim()) { setMessage('請先上載 Screenshot 並輸入帳號／品牌。'); return }
    setAnalysing(true); setMessage('')
    try {
      const response = await fetch('/api/content-directions/analyse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageUrl: draft.imageUrl, account: draft.account, platform: draft.platform, capturedAt: draft.capturedAt }) })
      const payload = await response.json().catch(() => ({}))
      if (response.ok) {
        setDraft((current) => ({ ...current, ...payload.suggestion, imageUrl: current.imageUrl, account: current.account, capturedAt: current.capturedAt, metricsCapturedAt: current.capturedAt }))
        setMessage('AI 初步拆解已完成；請核對及修改後再加入研究庫。')
      } else setMessage(payload.error || 'AI 暫時未能分析 Screenshot')
    } catch {
      setMessage('AI 分析連線中斷，請稍後再試。')
    } finally {
      setAnalysing(false)
    }
  }

  async function save() {
    setSaving(true); setMessage('')
    const response = await fetch('/api/content-directions', { method: draft.id ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft) })
    const payload = await response.json().catch(() => ({}))
    if (response.ok) { setDraft({ ...empty, capturedAt: today(), metricsCapturedAt: today() }); setMessage(draft.id ? '研究已更新。' : '已加入 Content Direction Lab。'); await load() }
    else setMessage(payload.error || '未能儲存研究')
    setSaving(false)
  }

  return <section className="lab"><header><div><small>SOON CONTENT STYLES</small><h1>選擇內容風格</h1><p>以卡片瀏覽內容風格與 reference；最新更新會排最前。</p></div><div className="summary"><strong>{items.length}</strong><span>個風格研究</span></div></header>
    {message ? <div className="notice">{message}</div> : null}
    <div className="quick"><div><small>QUICK CAPTURE</small><h2>Screenshot ＋帳號，AI 幫你起稿</h2><p>先生成可編輯草稿；確認內容後才正式加入研究庫。</p></div><div className="quick-actions"><label><span>帳號／品牌</span><input value={draft.account} onChange={(e) => update('account', e.target.value)} placeholder="例如：@ikea_taiwan" /></label><label className="quick-upload">{uploading ? '正在上載…' : draft.imageUrl ? '✓ 更換 Screenshot' : '上載 Screenshot'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || analysing} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = '' }} /></label><button type="button" disabled={uploading || analysing || !draft.imageUrl || !draft.account.trim()} onClick={() => void analyse()}>{analysing ? 'AI 正在拆解…' : 'AI 建立草稿'}</button></div></div>
    <div className="layout"><form onSubmit={(event) => { event.preventDefault(); void save() }}><div className="form-head"><div><small>{draft.id ? 'EDIT RESEARCH' : 'DAILY CAPTURE'}</small><h2>{draft.id ? '編輯方向研究' : '收藏今日好帖'}</h2></div>{draft.id ? <button type="button" onClick={() => setDraft({ ...empty, capturedAt: today(), metricsCapturedAt: today() })}>新增另一篇</button> : null}</div>
      <div className="fields"><label>研究標題<input required value={draft.title} onChange={(e) => update('title', e.target.value)} placeholder="例如：用高價新品反轉推低價產品" /></label><label>帳號／品牌<input required value={draft.account} onChange={(e) => update('account', e.target.value)} placeholder="例如：@ikea_taiwan" /></label></div>
      <div className="fields three"><label>平台<select value={draft.platform} onChange={(e) => update('platform', e.target.value)}><option>Threads</option><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>Facebook</option><option>LinkedIn</option><option>其他</option></select></label><label>類型<select value={draft.kind} onChange={(e) => update('kind', e.target.value)}><option value="moment">Moment Marketing</option><option value="evergreen">Evergreen Direction</option></select></label><label>收藏日期<input type="date" value={draft.capturedAt || ''} onChange={(e) => update('capturedAt', e.target.value)} /></label></div>
      <div className="fields"><label>原帖連結<input type="url" value={draft.postUrl || ''} onChange={(e) => update('postUrl', e.target.value)} placeholder="https://…" /></label><label>發布日期<input type="date" value={draft.publishedAt || ''} onChange={(e) => update('publishedAt', e.target.value)} /></label></div>
      <div className="shot"><div>{draft.imageUrl ? <Image src={draft.imageUrl} alt="收藏帖文截圖" fill sizes="(max-width: 900px) 100vw, 460px" /> : <span>未有截圖</span>}</div><label className="upload">{uploading ? '正在上載…' : '上載 Screenshot'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = '' }} /></label></div>
      {draft.kind === 'moment' ? <fieldset><legend>事件背景</legend><div className="fields"><label>Event／熱話<input value={draft.eventName || ''} onChange={(e) => update('eventName', e.target.value)} placeholder="iPhone 18 Pro 發布" /></label><label>Event Date<input type="date" value={draft.eventDate || ''} onChange={(e) => update('eventDate', e.target.value)} /></label></div><div className="fields four"><label>Trend Stage<select value={draft.trendStage || ''} onChange={(e) => update('trendStage', e.target.value)}><option>發布前</option><option>發布當日</option><option>發布後</option><option>預訂期</option><option>正式發售</option><option>熱度回落</option></select></label><label>熱話依賴<select value={draft.trendDependency || ''} onChange={(e) => update('trendDependency', e.target.value)}><option>高度</option><option>中度</option><option>低度</option></select></label><label>可重用窗口<input value={draft.reusableWindow || ''} onChange={(e) => update('reusableWindow', e.target.value)} placeholder="24 小時／3 日" /></label><label>品牌反應速度<input value={draft.responseSpeed || ''} onChange={(e) => update('responseSpeed', e.target.value)} placeholder="發布後 5 小時" /></label></div></fieldset> : null}
      <fieldset><legend>內容拆解</legend><div className="fields"><label>Hook<textarea rows={3} value={draft.hook || ''} onChange={(e) => update('hook', e.target.value)} /></label><label>格式<input value={draft.format || ''} onChange={(e) => update('format', e.target.value)} placeholder="比較表／單圖／Carousel" /></label></div><div className="fields"><label>視覺結構<textarea rows={3} value={draft.visualPattern || ''} onChange={(e) => update('visualPattern', e.target.value)} /></label><label>語氣／CTA<textarea rows={3} value={[draft.tone, draft.cta].filter(Boolean).join('\n')} onChange={(e) => { const [tone, ...cta] = e.target.value.split('\n'); setDraft((current) => ({ ...current, tone, cta: cta.join('\n') })) }} /></label></div><label>內容機制<textarea rows={4} value={draft.mechanism || ''} onChange={(e) => update('mechanism', e.target.value)} placeholder="點樣令觀眾停留、共鳴、收藏或分享？" /></label></fieldset>
      <fieldset className="core"><legend>SOON 判斷</legend><label>點解值得收藏<textarea required rows={4} value={draft.whySave} onChange={(e) => update('whySave', e.target.value)} /></label><label>可重用 Content Direction<textarea required rows={5} value={draft.reusableTemplate} onChange={(e) => update('reusableTemplate', e.target.value)} placeholder="抽象成可套用其他客戶的方向，而非直接抄原帖" /></label><div className="fields three"><label>適用行業<input value={join(draft.industries)} onChange={(e) => update('industries', split(e.target.value))} /></label><label>Campaign 目標<input value={join(draft.objectives)} onChange={(e) => update('objectives', split(e.target.value))} /></label><label>Tags<input value={join(draft.tags)} onChange={(e) => update('tags', split(e.target.value))} /></label></div><label>風險提示<textarea rows={3} value={draft.risks || ''} onChange={(e) => update('risks', e.target.value)} /></label></fieldset>
      <fieldset><legend>表現快照</legend><div className="metrics">{[['likes','Like'],['comments','Comment'],['shares','Share'],['reposts','Repost'],['views','View']].map(([key, label]) => <label key={key}>{label}<input type="number" min="0" value={draft.metrics?.[key] ?? ''} onChange={(e) => update('metrics', { ...(draft.metrics || {}), [key]: e.target.value })} /></label>)}<label>截取日期<input type="date" value={draft.metricsCapturedAt || ''} onChange={(e) => update('metricsCapturedAt', e.target.value)} /></label></div></fieldset>
      <button className="save" disabled={saving || uploading}>{saving ? '正在儲存…' : draft.id ? '儲存修改' : '加入研究庫'}</button></form>
      <aside><div className="index-head"><div><small>DIRECTION INDEX</small><h2>研究庫</h2></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋品牌、事件或打法" /></div><div className="filters"><button type="button" className={kind === 'all' ? 'active' : ''} onClick={() => setKind('all')}>全部</button><button type="button" className={kind === 'moment' ? 'active' : ''} onClick={() => setKind('moment')}>Moment</button><button type="button" className={kind === 'evergreen' ? 'active' : ''} onClick={() => setKind('evergreen')}>Evergreen</button></div>{loading ? <p className="empty">正在載入…</p> : filtered.length ? <div className="cards">{filtered.map((item) => <button type="button" className="card" key={item.id} onClick={() => edit(item)}>{item.imageUrl ? <span className="thumb"><Image src={item.imageUrl} alt="" fill sizes="110px" /></span> : null}<span className="card-body"><span className="meta"><em className={item.kind}>{item.kind === 'moment' ? 'MOMENT' : 'EVERGREEN'}</em><i>{item.platform}</i></span><strong>{item.title}</strong><b>{item.account}</b>{item.eventName ? <small>{item.eventName} · {item.trendStage}</small> : null}<p>{item.reusableTemplate}</p></span></button>)}</div> : <p className="empty">未有研究。由今日第一篇好帖開始。</p>}</aside></div>
    <style jsx>{`.lab{padding:40px;color:#f5f5f5}.lab>header{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:24px}.lab small{color:#a78bfa;font-size:10px;font-weight:800;letter-spacing:.14em}.lab h1{margin:7px 0;font-size:36px}.lab header p{margin:0;color:#888}.summary{display:grid;min-width:120px;border:1px solid #302747;border-radius:14px;background:#17131f;padding:15px;text-align:center}.summary strong{font-size:26px}.summary span{color:#888;font-size:10px}.notice{margin-bottom:16px;border:1px solid #3a3152;border-radius:10px;background:#1b1724;padding:11px;color:#c4b5fd;font-size:12px}.quick{display:flex;justify-content:space-between;gap:24px;align-items:center;margin-bottom:18px;border:1px solid #553c78;border-radius:16px;background:linear-gradient(120deg,#1d142a,#15131b);padding:19px 22px}.quick h2{margin:5px 0}.quick p{margin:0;color:#8c8495;font-size:11px}.quick-actions{display:flex;gap:9px;align-items:end}.quick-actions label{min-width:190px;margin:0}.quick-actions label span{color:#aaa}.quick-upload{display:block!important;min-width:150px!important;border:1px solid #55416f;border-radius:9px;background:#251b32;color:#d8b4fe!important;padding:10px 12px;text-align:center;cursor:pointer}.quick-upload input{display:none}.quick-actions button{min-width:132px;border:0;border-radius:9px;background:#7c3aed;color:white;padding:11px 13px;font-weight:800}.quick-actions button:disabled{opacity:.45}.layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(370px,.85fr);gap:18px}.layout>form,.layout>aside{border:1px solid #262626;border-radius:16px;background:#141414;padding:22px}.form-head,.index-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:18px}.lab h2{margin:4px 0;font-size:20px}.form-head button{border:0;background:transparent;color:#aaa}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.fields.three{grid-template-columns:repeat(3,minmax(0,1fr))}.fields.four{grid-template-columns:repeat(4,minmax(0,1fr))}.lab label{display:grid;gap:6px;margin-bottom:12px;color:#aaa;font-size:11px}.lab input,.lab textarea,.lab select{width:100%;border:1px solid #303030;border-radius:9px;background:#1c1c1c;color:#f5f5f5;padding:10px;outline:none}.lab input:focus,.lab textarea:focus,.lab select:focus{border-color:#7c3aed}fieldset{margin:18px 0;border:1px solid #292929;border-radius:12px;padding:16px}legend{padding:0 8px;color:#a78bfa;font-size:11px;font-weight:800}.core{border-color:#49356a;background:#181320}.shot{display:grid;grid-template-columns:110px 1fr;gap:12px;align-items:center;margin:4px 0 18px}.shot>div{position:relative;height:120px;border:1px dashed #3b3b3b;border-radius:10px;background:#191919;overflow:hidden;display:grid;place-items:center;color:#666;font-size:10px}.shot img,.thumb img{object-fit:cover}.upload{display:block!important;width:max-content!important;margin:0!important;border:1px solid #3a3152;border-radius:9px;background:#20192c;color:#c4b5fd!important;padding:10px 13px;cursor:pointer}.upload input{display:none}.metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.save{width:100%;border:0;border-radius:10px;background:#7c3aed;color:#fff;padding:13px;font-weight:800}.save:disabled{opacity:.55}.index-head input{max-width:205px}.filters{display:flex;gap:7px;margin-bottom:13px}.filters button{border:1px solid #303030;border-radius:999px;background:#1a1a1a;color:#888;padding:7px 11px;font-size:10px}.filters .active{border-color:#7c3aed;background:#271b3a;color:#c4b5fd}.cards{display:grid;gap:9px;max-height:1350px;overflow:auto}.card{display:flex;width:100%;gap:12px;border:1px solid #292929;border-radius:12px;background:#1a1a1a;color:#fff;padding:12px;text-align:left}.card:hover{border-color:#5b3b91}.thumb{position:relative;flex:0 0 90px;height:112px;border-radius:8px;overflow:hidden}.card-body{min-width:0;display:grid;gap:6px}.meta{display:flex;gap:7px;align-items:center}.meta em{border-radius:999px;background:#242424;color:#aaa;padding:4px 7px;font-size:8px;font-style:normal}.meta .moment{background:#3b1d28;color:#fda4af}.meta i{color:#666;font-size:9px;font-style:normal}.card strong{font-size:14px}.card b{color:#aaa;font-size:10px}.card small{color:#f59e0b;letter-spacing:0}.card p{margin:0;color:#858585;font-size:10px;line-height:1.45}.empty{color:#777;font-size:12px}@media(max-width:1150px){.quick{align-items:stretch;flex-direction:column}.quick-actions{align-items:stretch}.quick-actions label{flex:1}.layout{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(3,1fr)}}@media(max-width:720px){.lab{padding:22px}.lab>header{align-items:flex-start;flex-direction:column}.quick-actions{flex-direction:column}.quick-actions label,.quick-upload,.quick-actions button{width:100%;min-width:0!important}.fields,.fields.three,.fields.four{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,1fr)}.index-head{align-items:stretch;flex-direction:column}.index-head input{max-width:none}}`}</style>
    <style jsx>{`
      .layout { grid-template-columns: 1fr; }
      .layout > aside { order: -1; }
      .cards { grid-template-columns: repeat(4, minmax(0, 1fr)); max-height: none; }
      .card { flex-direction: column; min-width: 0; padding: 0; overflow: hidden; }
      .thumb { width: 100%; height: auto; aspect-ratio: 1 / 1; flex-basis: auto; border-radius: 0; }
      .card-body { padding: 13px; }
      @media (max-width: 1180px) { .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      @media (max-width: 850px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 560px) { .cards { grid-template-columns: 1fr; } }
    `}</style>
  </section>
}
