'use client'

import { useEffect, useRef, useState } from 'react'

type Result = { classification: 'topic' | 'direction' | 'method' | 'campaign'; confidence: number; reason: string; questions?: string[]; draft: Record<string, unknown> }
const labels = { topic: '題材', direction: 'Content Direction', method: 'Content Method', campaign: 'Campaign Experience' }
type Watchlist = { id: string; platform: string; collection_mode: string; identifier: string; label?: string; industry_codes?: string[]; last_collected_at?: string; last_error?: string }
type InboxItem = { id: string; platform: string; source_url: string; source_account?: string; content_text?: string; media_type?: string; thumbnail_url?: string; published_at?: string; industry_codes?: string[]; primary_industry_code?: string | null; secondary_industry_codes?: string[]; industry_confidence?: number | null; industry_classification_status?: 'classified' | 'needs_review' }

export function IntelligenceInbox() {
  const [files, setFiles] = useState<File[]>([])
  const [context, setContext] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [capturedItems, setCapturedItems] = useState<InboxItem[]>([])
  const [collectorBusy, setCollectorBusy] = useState(false)
  const [reviewingItemId, setReviewingItemId] = useState<string | null>(null)
  const oauthReturnHandled = useRef(false)
  const resultRef = useRef<HTMLElement>(null)
  const [showSourceForm, setShowSourceForm] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState('all')
  const [selectedCandidateIndustry, setSelectedCandidateIndustry] = useState('all')
  const [source, setSource] = useState({ platform: 'threads', collectionMode: 'keyword', identifier: '', label: '', learningFocus: '', industryCodes: [] as string[], consentBasis: 'public_research' })
  const industries = [{ code: 'food_beverage', label: '飲食' }, { code: 'travel_experience', label: '旅遊' }, { code: 'sports_wellness', label: '運動健康' }, { code: 'home_living', label: '家居產品' }, { code: 'medical_aesthetics_wellness', label: '醫美保健' }, { code: 'beauty_cosmetics', label: '美容化妝' }, { code: 'trend_culture', label: '潮流文化' }, { code: 'technology_information', label: '科技資訊' }]

  async function loadCollector() {
    const response = await fetch('/api/intelligence-watchlists', { cache: 'no-store' })
    if (!response.ok) return
    const data = await response.json()
    setWatchlists(data.watchlists ?? []); setCapturedItems(data.items ?? [])
  }

  useEffect(() => {
    if (oauthReturnHandled.current) return
    oauthReturnHandled.current = true
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('instagram_connected') === 'true'
    window.history.replaceState({}, '', window.location.pathname)
    queueMicrotask(() => {
      if (connected) {
        setMessage('Meta 已連接，正在同步觀察來源…')
        void collect()
      } else {
        void loadCollector()
      }
    })
  }, [])

  async function addSource() {
    setCollectorBusy(true); setMessage('')
    try {
      const response = await fetch('/api/intelligence-watchlists', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(source) })
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || '未能加入來源')
      setSource((value) => ({ ...value, identifier: '', label: '', learningFocus: '', industryCodes: [] })); setShowSourceForm(false); setMessage('已加入觀察名單。')
      await loadCollector()
    } catch (error) { setMessage(error instanceof Error ? error.message : '未能加入來源') } finally { setCollectorBusy(false) }
  }

  async function collect(id?: string) {
    setCollectorBusy(true); setMessage('')
    try {
      const response = await fetch('/api/intelligence-watchlists/collect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || '同步失敗')
      const failed = (data.results ?? []).filter((item: { status: string }) => item.status === 'error').length
      setMessage(`同步完成，新擷取 ${data.captured ?? 0} 項${failed ? `；${failed} 個來源等待權限或設定` : ''}。`); await loadCollector()
    } catch (error) { setMessage(error instanceof Error ? error.message : '同步失敗') } finally { setCollectorBusy(false) }
  }

  async function reclassifyCandidates() {
    setCollectorBusy(true); setMessage('正在逐篇分析候選分類…')
    try {
      let total = 0
      for (let batch = 0; batch < 6; batch += 1) {
        const response = await fetch('/api/intelligence-watchlists/collect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reclassify' }) })
        const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || '重新分類失敗')
        total += Number(data.classified) || 0
        setMessage(`已逐篇重新分類 ${total} 項；尚餘 ${data.remaining ?? 0} 項…`)
        if (!data.remaining || !data.classified) break
      }
      setMessage(`已逐篇重新分類 ${total} 項候選。`); await loadCollector()
    } catch (error) { setMessage(error instanceof Error ? error.message : '重新分類失敗') } finally { setCollectorBusy(false) }
  }

  async function reviewCaptured(item: InboxItem) {
    const capturedContext = `自動擷取自 ${item.platform}／${item.source_account || '公開來源'}。請分析其 Hook、Content Direction、Method 及可重用價值。\n\n${item.content_text || ''}`
    setSourceUrl(item.source_url); setContext(capturedContext); setReviewingItemId(item.id); setBusy(true); setMessage(''); setResult(null)
    try {
      const form = new FormData(); form.set('context', capturedContext); form.set('sourceUrl', item.source_url)
      const response = await fetch('/api/intelligence-inbox/analyse', { method: 'POST', body: form })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || '分析失敗')
      setResult(data)
      await fetch('/api/intelligence-watchlists', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemId: item.id, status: 'reviewing' }) })
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '分析失敗')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally { setBusy(false); setReviewingItemId(null) }
  }

  async function dismissCaptured(itemId: string) {
    await fetch('/api/intelligence-watchlists', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemId, status: 'dismissed' }) })
    setCapturedItems((items) => items.filter((item) => item.id !== itemId))
  }

  async function promoteCaptured(itemId: string) {
    setCollectorBusy(true); setMessage('')
    try {
      const response = await fetch('/api/intelligence-watchlists/promote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemId }) })
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || '未能加入題材庫')
      setMessage('已加入題材資料庫「待審閱」。發布後 EGG 同 SOON Creator 會自動讀到。'); await loadCollector()
    } catch (error) { setMessage(error instanceof Error ? error.message : '未能加入題材庫') } finally { setCollectorBusy(false) }
  }

  async function analyse() {
    setBusy(true); setMessage(''); setResult(null)
    try {
      const form = new FormData(); form.set('context', context); form.set('sourceUrl', sourceUrl); files.forEach((file) => form.append('files', file))
      const response = await fetch('/api/intelligence-inbox/analyse', { method: 'POST', body: form })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || '分析失敗')
      setResult(data)
    } catch (error) { setMessage(error instanceof Error ? error.message : '分析失敗') } finally { setBusy(false) }
  }

  async function confirm() {
    if (!result) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/intelligence-inbox/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ classification: result.classification, draft: result.draft }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || '未能加入 Core')
      setMessage(`已加入 ${labels[result.classification]}，狀態：${data.status === 'review' ? '待審批' : '已儲存'}。`)
      setFiles([]); setContext(''); setSourceUrl(''); setResult(null)
    } catch (error) { setMessage(error instanceof Error ? error.message : '未能加入 Core') } finally { setBusy(false) }
  }

  function creatorImportUrl() {
    if (!result) return 'https://sooncreator.network/onboarding/content-studio'
    const payload = JSON.stringify({
      version: 1,
      source: 'soon_core_intelligence',
      sourceUrl: sourceUrl.trim(),
      content: context.trim(),
      classification: result.classification,
      analysisReason: result.reason,
    })
    return `https://sooncreator.network/onboarding/content-studio#coreImport=${encodeURIComponent(payload)}`
  }

  const visibleWatchlists = selectedIndustry === 'all' ? watchlists : watchlists.filter((item) => item.industry_codes?.includes(selectedIndustry))
  const itemIndustryCodes = (item: InboxItem) => [item.primary_industry_code, ...(item.secondary_industry_codes ?? [])].filter((code): code is string => Boolean(code))
  const visibleCapturedItems = selectedCandidateIndustry === 'all' ? capturedItems : capturedItems.filter((item) => itemIndustryCodes(item).includes(selectedCandidateIndustry))
  const activeIndustries = industries.filter((industry) => watchlists.some((item) => item.industry_codes?.includes(industry.code)))
  const activeCandidateIndustries = industries.filter((industry) => capturedItems.some((item) => itemIndustryCodes(item).includes(industry.code)))

  return <main className="inbox">
    <header><small>SOON INTELLIGENCE</small><h1>Intelligence Inbox</h1><p>唔使揀資料庫、唔使逐格填。掉入嚟，AI 分類；你確認後先正式保存。</p></header>
    {message ? <div className="notice">{message}</div> : null}
    <section className="collector candidate-queue"><div className="collector-head"><div><small>REVIEW QUEUE</small><h2>自動擷取候選</h2><p>{visibleCapturedItems.length} 項屬於目前分類，等待你決定值唔值得學。</p></div><div><button className="secondary" disabled={collectorBusy || !capturedItems.length} onClick={() => void reclassifyCandidates()}>{collectorBusy ? '分析中…' : '逐篇重新分類'}</button></div></div>
      <nav className="category-tabs candidate-tabs" aria-label="自動擷取候選主分類"><button className={selectedCandidateIndustry === 'all' ? 'active' : ''} onClick={() => setSelectedCandidateIndustry('all')}>全部 <span>{capturedItems.length}</span></button>{activeCandidateIndustries.map((industry) => <button key={industry.code} className={selectedCandidateIndustry === industry.code ? 'active' : ''} onClick={() => setSelectedCandidateIndustry(industry.code)}>{industry.label} <span>{capturedItems.filter((item) => itemIndustryCodes(item).includes(industry.code)).length}</span></button>)}</nav>
      <div className="captured-grid">{visibleCapturedItems.length ? visibleCapturedItems.map((item) => <article key={item.id}><div className="media-frame"><span className="media-fallback" aria-hidden="true"><b>圖片預覽未能載入</b><small>仍可分析文字內容</small></span>{item.thumbnail_url ? <img src={item.thumbnail_url} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : null}</div><div className="captured-copy"><small>{item.platform} · {item.source_account || '公開來源'}</small>{itemIndustryCodes(item).length ? <div className="item-categories">{itemIndustryCodes(item).map((code, index) => <i key={code}>{index === 0 ? '主：' : '次：'}{industries.find((industry) => industry.code === code)?.label || code}</i>)}{item.industry_classification_status === 'needs_review' ? <i>待確認</i> : null}</div> : <div className="item-categories"><i>待分類</i></div>}<b>{(item.content_text || item.source_url).slice(0, 140)}</b><span>{item.published_at ? new Date(item.published_at).toLocaleDateString('zh-HK') : ''}{item.industry_confidence != null ? ` · 分類信心 ${Math.round(Number(item.industry_confidence) * 100)}%` : ''}</span></div><footer><button className="secondary" disabled={Boolean(reviewingItemId)} onClick={() => void dismissCaptured(item.id)}>略過</button><button className="secondary" disabled={collectorBusy || Boolean(reviewingItemId)} onClick={() => void promoteCaptured(item.id)}>放入題材庫</button><button disabled={Boolean(reviewingItemId)} onClick={() => void reviewCaptured(item)}>{reviewingItemId === item.id ? 'AI 分析中…' : '交俾 AI 分析'}</button></footer></article>) : <div className="empty">呢個分類暫時未有候選內容。</div>}</div></section>
    <section className="capture">
      <div className="section-title"><small>MANUAL INBOX</small><h2>Intelligence Inbox</h2><p>加入你手上嘅 Screenshot、文件、連結或背景資料。</p></div>
      <label className="drop"><strong>{files.length ? `${files.length} 個檔案已選擇` : '加入 Screenshot／PDF／PowerPoint'}</strong><span>圖片最多 9 張；每個檔案最多 15MB</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,.pdf,.pptx" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 9))} /></label>
      <label>來源連結（可留空）<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Instagram／Threads／Google Drive…" /></label>
      <label>你想我知道嘅背景（可留空）<textarea rows={5} value={context} onChange={(event) => setContext(event.target.value)} placeholder="例如：呢個係網上教 Hook；或者呢份係未執行嘅客戶 proposal。" /></label>
      <button disabled={busy || (!files.length && !context.trim() && !sourceUrl.trim())} onClick={() => void analyse()}>{busy ? '正在分類及整理…' : '自動分析'}</button>
    </section>
    {result ? <section className="result" ref={resultRef}><div className="result-head"><div><small>AUTO CLASSIFIED</small><h2>{labels[result.classification]}</h2></div><strong>{Math.round((result.confidence || 0) * 100)}%</strong></div><p>{result.reason}</p>
      {result.questions?.length ? <div className="questions"><b>仍需你補充</b>{result.questions.map((question) => <span key={question}>• {question}</span>)}<small>將答案寫入上面「背景」，再按一次自動分析。</small></div> : null}
      <div className="preview">{Object.entries(result.draft).filter(([, value]) => value !== '' && value != null && (!Array.isArray(value) || value.length)).slice(0, 12).map(([key, value]) => <div key={key}><b>{key}</b><span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span></div>)}</div>
      <footer><button className="secondary" onClick={() => setResult(null)}>重新整理</button><a className="creator-transfer" href={creatorImportUrl()} target="_blank" rel="noreferrer">放入 SOON Creator</a><button disabled={busy || Boolean(result.questions?.length)} onClick={() => void confirm()}>確認加入 Core</button></footer>
    </section> : null}
    <section className="collector"><div className="collector-head"><div><small>AUTO CAPTURE</small><h2>Social Watchlist</h2><p>指定帳號、關鍵字或 hashtag；新內容只會先進入候選區。</p></div><div><a className="connect" href="https://egg.sooncreator.network/api/auth/instagram?collector=true&next=/core" target="_blank" rel="noreferrer">連接／更新 Meta</a><button className="secondary" disabled={collectorBusy || !watchlists.length} onClick={() => void collect()}>立即同步全部</button><button onClick={() => setShowSourceForm((value) => !value)}>＋ 加入來源</button></div></div>
      <nav className="category-tabs" aria-label="Social Watchlist 主分類"><button className={selectedIndustry === 'all' ? 'active' : ''} onClick={() => setSelectedIndustry('all')}>全部 <span>{watchlists.length}</span></button>{activeIndustries.map((industry) => <button key={industry.code} className={selectedIndustry === industry.code ? 'active' : ''} onClick={() => setSelectedIndustry(industry.code)}>{industry.label} <span>{watchlists.filter((item) => item.industry_codes?.includes(industry.code)).length}</span></button>)}</nav>
      {showSourceForm ? <div className="source-form"><label>平台<select value={source.platform} onChange={(event) => setSource({ ...source, platform: event.target.value, collectionMode: event.target.value === 'threads' ? 'keyword' : 'public_account' })}><option value="threads">Threads</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option></select></label><label>收集方式<select value={source.collectionMode} onChange={(event) => setSource({ ...source, collectionMode: event.target.value })}>{source.platform === 'threads' ? <><option value="keyword">關鍵字</option><option value="hashtag">Topic tag</option></> : <><option value="public_account">公開專業帳號／Page</option><option value="owned_account">已授權帳號</option></>}</select></label><label>帳號／關鍵字<input value={source.identifier} onChange={(event) => setSource({ ...source, identifier: event.target.value })} placeholder="例如 ikea_taiwan 或 AI content" /></label><label>名稱（可留空）<input value={source.label} onChange={(event) => setSource({ ...source, label: event.target.value })} /></label><fieldset className="industry-picker"><legend>主分類（最多 3 個）</legend>{industries.map((industry) => <label key={industry.code}><input type="checkbox" checked={source.industryCodes.includes(industry.code)} disabled={!source.industryCodes.includes(industry.code) && source.industryCodes.length >= 3} onChange={(event) => setSource({ ...source, industryCodes: event.target.checked ? [...source.industryCodes, industry.code] : source.industryCodes.filter((code) => code !== industry.code) })} />{industry.label}</label>)}</fieldset><label className="wide">想學嘅方向（可留空）<input value={source.learningFocus} onChange={(event) => setSource({ ...source, learningFocus: event.target.value })} placeholder="例如產品融入、反常識 Hook" /></label><label>資料用途<select value={source.consentBasis} onChange={(event) => setSource({ ...source, consentBasis: event.target.value })}><option value="public_research">公開研究</option><option value="soon_owned">SOON 自家帳號</option><option value="client_authorized">客戶已授權</option></select></label><button disabled={collectorBusy || !source.identifier.trim()} onClick={() => void addSource()}>儲存來源</button></div> : null}
      <div className="watchlist">{visibleWatchlists.length ? visibleWatchlists.map((item) => <article key={item.id}><div><b>{item.label || item.identifier}</b><span>{item.platform} · {item.collection_mode}</span>{item.industry_codes?.length ? <small>{item.industry_codes.map((code) => industries.find((industry) => industry.code === code)?.label || code).join(' · ')}</small> : null}{item.last_error ? <em>{item.last_error}</em> : <small>{item.last_collected_at ? `上次同步 ${new Date(item.last_collected_at).toLocaleString('zh-HK')}` : '尚未同步'}</small>}</div><button disabled={collectorBusy} onClick={() => void collect(item.id)}>同步</button></article>) : <div className="empty">呢個分類未有觀察來源。</div>}</div>
    </section>
    <style jsx>{`.inbox{padding:40px;color:#f5f5f5;max-width:1480px}.inbox header small,.result small,.collector small,.section-title small{color:#f0abfc;font-size:10px;font-weight:900;letter-spacing:.16em}.inbox h1{font-size:38px;margin:8px 0}.inbox header p,.collector p,.section-title p{color:#999}.notice{margin:18px 0;border:1px solid #34523f;background:#14231a;color:#86efac;border-radius:12px;padding:13px}.capture,.result,.collector{margin-top:24px;border:1px solid #34283d;background:#17131b;border-radius:18px;padding:22px}.section-title{margin-bottom:18px}.section-title h2{margin:5px 0}.section-title p{margin:4px 0}.capture label,.source-form label{display:grid;gap:7px;margin-bottom:15px;color:#aaa;font-size:11px}.capture input,.capture textarea,.source-form input,.source-form select{border:1px solid #333;background:#1d1b1f;color:#fff;border-radius:10px;padding:12px}.drop{place-items:center;border:1px dashed #6b3d73;border-radius:14px;padding:30px!important;text-align:center;cursor:pointer}.drop strong{color:#fff;font-size:15px}.drop span{color:#777}.drop input{display:none}.capture>button,.result footer button,.result footer a,.collector button,.connect{border:0;border-radius:10px;background:#9333ea;color:white;padding:11px 15px;font-weight:850;text-decoration:none;font-size:13px}.result footer .creator-transfer{background:#2563eb}.connect{background:#334155}.connect.paused{background:#422006;color:#fbbf24;cursor:not-allowed}.capture>button{width:100%}button:disabled{opacity:.4}.result-head,.collector-head{display:flex;justify-content:space-between;align-items:center;gap:20px}.collector-head>div:last-child{display:flex;gap:8px;flex-wrap:wrap}.collector h2{margin:5px 0}.collector-head p{margin:4px 0}.result h2{margin:5px 0;font-size:26px}.result-head>strong{font-size:26px;color:#f0abfc}.result>p{color:#aaa}.questions{display:grid;gap:7px;background:#2a2115;border:1px solid #59401c;color:#fcd34d;border-radius:12px;padding:14px}.questions small{color:#b9a477}.preview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:17px 0}.preview div{display:grid;gap:5px;border:1px solid #292929;background:#191919;border-radius:10px;padding:11px;min-word:break-word}.preview b{font-size:9px;color:#a78bfa;text-transform:uppercase}.preview span{font-size:12px;color:#bbb;line-height:1.5}.result footer{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap}.secondary{background:#292929!important;color:#bbb!important}.category-tabs{display:flex;gap:8px;overflow-x:auto;margin:18px 0 4px;padding-bottom:4px}.category-tabs button{flex:none;background:#242027;color:#aaa;border:1px solid #38303e}.category-tabs button.active{background:#6b21a8;color:#fff;border-color:#a855f7}.category-tabs span{display:inline-grid;place-items:center;min-width:20px;height:20px;margin-left:5px;border-radius:999px;background:rgba(255,255,255,.1);font-size:10px}.source-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px;border-top:1px solid #29232e;margin-top:18px;padding-top:18px}.source-form .wide{grid-column:1/-1}.source-form>button{align-self:end;margin-bottom:15px}.watchlist{display:grid;gap:8px;margin-top:18px}.watchlist article{display:flex;align-items:center;justify-content:space-between;background:#1d1a20;border:1px solid #302936;border-radius:12px;padding:12px}.watchlist article>div{display:grid;gap:4px}.watchlist span,.watchlist small{color:#777;font-size:11px}.watchlist em{color:#fca5a5;font-size:11px;font-style:normal}.captured-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:18px}.captured-grid article{display:flex;min-width:0;overflow:hidden;flex-direction:column;border:1px solid #302936;border-radius:13px;background:#1d1a20}.media-frame{position:relative;display:grid;aspect-ratio:1/1;place-items:center;overflow:hidden;background:radial-gradient(circle at 30% 20%,#392345,#17131b 70%);color:#8d7696;text-align:center}.media-fallback{display:grid;gap:6px;place-items:center;padding:18px;letter-spacing:0}.media-fallback b{font-size:12px;color:#bda7c6}.media-fallback small{font-size:10px;color:#75627d;letter-spacing:0}.media-frame img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover}.captured-copy{display:grid;gap:7px;padding:13px}.item-categories{display:flex;gap:5px;flex-wrap:wrap}.item-categories i{border:1px solid #51385c;border-radius:999px;color:#d8b4fe;padding:3px 7px;font-size:9px;font-style:normal}.captured-grid b{display:-webkit-box;overflow:hidden;font-size:12px;line-height:1.45;-webkit-box-orient:vertical;-webkit-line-clamp:4}.captured-copy span{color:#777;font-size:10px}.captured-grid footer{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:auto;padding:0 13px 13px}.captured-grid footer button{min-width:0;padding:9px 7px;font-size:11px}.captured-grid footer button:last-child{grid-column:1/-1}.empty{color:#666;border:1px dashed #353039;border-radius:12px;padding:25px;text-align:center;grid-column:1/-1}@media(max-width:1180px){.captured-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:900px){.captured-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.inbox{padding:22px}.preview,.source-form,.captured-grid{grid-template-columns:1fr}.collector-head{align-items:flex-start;flex-direction:column}.source-form .wide{grid-column:auto}}`}</style>
  </main>
}
