'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, Suspense, useRef, useEffect, useCallback } from 'react'


const SHOT_TYPES: Record<string, { name: string; desc: string }[]> = {
  wide:    [{ name: 'Wide Shot', desc: '交代環境全景' }],
  medium:  [{ name: 'Medium Shot', desc: '主持半身，自然對話感' }],
  close:   [{ name: 'Close-up', desc: '表情特寫，情感衝擊' }],
  product: [{ name: '產品特寫', desc: '近鏡拍攝質感同造型' }],
  reaction:[{ name: '反應鏡頭', desc: '主持真實反應同表情' }],
  follow:  [{ name: '手持跟拍', desc: '跟住主持移動，動感十足' }],
  overhead:[{ name: '俯拍', desc: '由上方拍攝，適合食物展示' }],
  broll:   [{ name: 'B-roll', desc: '環境補充畫面，配合旁白' }],
}


const HOOK_MAP: Record<string, { code: string; name: string; teaser: string }[]> = {
  food: [
    { code: 'H2', name: '真定假 — 直接挑戰', teaser: '質疑佢嘅名氣，幫觀眾驗證' },
    { code: 'H4', name: '感官喚起 + 懸念',   teaser: '用香味／顏色勾起好奇' },
    { code: 'H5', name: '反差驚喜 — 竟然',   teaser: '外表平凡但質素出人意表' },
  ],
  general: [
    { code: 'H3', name: '聽講 — 半信半疑',   teaser: '借第三者說法引入懸念' },
    { code: 'H7', name: '荒誕事實',           teaser: '真實但匪夷所思嘅背景' },
    { code: 'H8', name: '代入感假設',         teaser: '直問觀眾「如果你係…」' },
  ],
  queue: [
    { code: 'H1', name: '極端行動質問',       teaser: '有人排足幾個鐘，值唔值？' },
    { code: 'H2', name: '真定假 — 挑戰',      teaser: '親身測試係咪值得排' },
    { code: 'H5', name: '反差驚喜',           teaser: '以為係噱頭，原來有原因' },
  ],
  vlog: [
    { code: 'H6', name: '意外自我披露',       teaser: '個人故事拉近觀眾距離' },
    { code: 'H4', name: '感官喚起',           teaser: '一入去就知道唔同' },
    { code: 'H8', name: '代入感假設',         teaser: '帶觀眾一齊去' },
  ],
  chef: [
    { code: 'H3', name: '聽講 — 懸念',       teaser: '廚師有段唔為人知嘅故事' },
    { code: 'H6', name: '意外自我披露',       teaser: '放棄高薪追夢嘅真實故事' },
    { code: 'H7', name: '荒誕事實',           teaser: '凌晨三點開工嘅真相' },
  ],
  attraction: [
    { code: 'H4', name: '感官喚起 + 懸念',   teaser: '有樣嘢你唔親眼見唔會信' },
    { code: 'H8', name: '代入感假設',         teaser: '路過唔入會後悔' },
    { code: 'H5', name: '反差驚喜',           teaser: '外面普通，入面另一個世界' },
  ],
}


const TRANS_MAP: Record<string, { code: string; name: string }> = {
  food: { code: 'T4', name: '實測宣言 — 等我試下' },
  general: { code: 'T2', name: '轉念 — 入去先信咗' },
  queue: { code: 'T1', name: '情緒代入 — 同行感' },
  vlog: { code: 'T8', name: '頓悟時刻' },
  chef: { code: 'T7', name: '靈魂轉移 — 重點喺呢度' },
  attraction: { code: 'T5', name: '場景切割 — 另有真相' },
}


const END_MAP: Record<string, { code: string; name: string }> = {
  food: { code: 'E2', name: '值唔值得 — 親身作答' },
  general: { code: 'E1', name: '留白式 Verdict' },
  queue: { code: 'E2', name: '值唔值得 — 親身作答' },
  vlog: { code: 'E6', name: '個人感悟 — 超越食玩' },
  chef: { code: 'E7', name: '哲學收結' },
  attraction: { code: 'E5', name: '詩意留白' },
}


type Shot = {
  id: string; text: string; shotType: string; shotDesc: string
  recorded: boolean; skipped: boolean; videoUrl?: string
}


type Part = {
  id: string; label: string; type: 'hook'|'bg'|'trans'|'test'|'end'
  subStep: 'review'|'camera'; editableContent: string
  shots: Shot[]; done: boolean; skipped: boolean
}


const recBtnStyle: React.CSSProperties = { width:68, height:68, borderRadius:'50%', border:'3px solid white', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }
const skipBtnStyle: React.CSSProperties = { background:'none', border:'1px solid var(--border)', borderRadius:'var(--radius-pill)', padding:'9px 16px', fontSize:12, color:'var(--ink3)', cursor:'pointer' }

function CameraView({ onSave, onRetake, onSkip, shotText, shotType, partLabel }: {
  onSave: (url: string) => void; onRetake: () => void; onSkip: () => void
  shotText: string; shotType: string; partLabel: string
}) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState]         = useState<'preview'|'recording'|'review'>('preview')
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [elapsed, setElapsed]     = useState(0)
  const [camError, setCamError]   = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; videoRef.current.play() }
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; videoRef.current.play() }
      } catch (e: any) { setCamError('無法開啟鏡頭：' + (e.message || '請允許鏡頭權限')) }
    }
  }, [])

  useEffect(() => { startCamera(); return () => { streamRef.current?.getTracks().forEach(t => t.stop()) } }, [startCamera])

  const startRec = () => {
    if (!streamRef.current) return
    chunksRef.current = []
    const mr = new MediaRecorder(streamRef.current)
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const url  = URL.createObjectURL(blob)
      setRecordedUrl(url)
      setState('review')
      if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.src = url; videoRef.current.muted = false; videoRef.current.play() }
    }
    mr.start(); mediaRef.current = mr; setState('recording'); setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000)
  }

  const stopRec = () => { mediaRef.current?.stop(); if (timerRef.current) clearInterval(timerRef.current) }

  const retake = async () => {
    setRecordedUrl(null); setState('preview'); setElapsed(0)
    if (videoRef.current) { videoRef.current.src = ''; videoRef.current.muted = true }
    await startCamera(); onRetake()
  }

  const confirm = () => { streamRef.current?.getTracks().forEach(t => t.stop()); onSave(recordedUrl || '') }
  const fmt = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`

  if (camError) return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:24 }}>
      <div style={{ fontSize:13, color:'var(--ink3)', textAlign:'center', lineHeight:1.7 }}>{camError}</div>
      <button onClick={onSkip} style={skipBtnStyle}>跳過呢個鏡頭</button>
    </div>
  )

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <div>
          <div style={{ fontSize:11, color:'var(--accent2)', marginBottom:2 }}>{partLabel}</div>
          <div style={{ fontSize:12, color:'var(--ink2)', lineHeight:1.5, maxWidth:220 }}>{shotText}</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:10, color:'var(--ink3)', marginBottom:2 }}>{shotType}</div>
          {state === 'recording' && <div style={{ fontSize:13, color:'#E24B4A', fontVariantNumeric:'tabular-nums' }}>● {fmt(elapsed)}</div>}
        </div>
      </div>
      <div style={{ flex:1, position:'relative', background:'#000', margin:'10px 20px', borderRadius:'var(--radius)', overflow:'hidden', minHeight:280 }}>
        <video ref={videoRef} style={{ width:'100%', height:'100%', objectFit:'cover' }} playsInline autoPlay muted={state !== 'review'} controls={state === 'review'} />
        {state !== 'review' && (
          <div style={{ position:'absolute', inset:0, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', pointerEvents:'none' }}>
            {[...Array(9)].map((_,i) => <div key={i} style={{ border:'0.5px solid rgba(255,255,255,0.12)' }} />)}
          </div>
        )}
        {state === 'preview' && (
          <div style={{ position:'absolute', top:0, left:0, right:0, padding:'10px 14px', background:'rgba(0,0,0,0.55)' }}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.9)' }}>{shotText}</div>
          </div>
        )}
        {state === 'recording' && (
          <div style={{ position:'absolute', top:12, left:14, display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#E24B4A', animation:'pulse 1s infinite' }} />
            <span style={{ fontSize:11, color:'#fff' }}>錄緊</span>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
          </div>
        )}
      </div>
      <div style={{ padding:'0 20px 24px' }}>
        {state === 'preview' && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:28 }}>
            <button onClick={onSkip} style={skipBtnStyle}>跳過</button>
            <button onClick={startRec} style={recBtnStyle}><div style={{ width:44, height:44, borderRadius:'50%', background:'#E24B4A' }} /></button>
            <div style={{ width:44 }} />
          </div>
        )}
        {state === 'recording' && (
          <div style={{ display:'flex', justifyContent:'center' }}>
            <button onClick={stopRec} style={recBtnStyle}><div style={{ width:24, height:24, borderRadius:4, background:'#fff' }} /></button>
          </div>
        )}
        {state === 'review' && (
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={retake} style={{ flex:1, background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--radius-pill)', padding:'13px', fontSize:14, color:'var(--ink)', cursor:'pointer' }}>重拍</button>
            <button onClick={confirm} style={{ flex:2, background:'var(--accent)', border:'none', borderRadius:'var(--radius-pill)', padding:'13px', fontSize:14, fontWeight:500, color:'#fff', cursor:'pointer' }}>確認用呢條 ✓</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ReviewStep({ part, onConfirm, onSkip }: { part: Part; onConfirm: (content: string) => void; onSkip: () => void }) {
  const [edited, setEdited] = useState(part.editableContent)
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'20px 20px 32px', maxWidth:480, width:'100%', margin:'0 auto', gap:16 }}>
      <div>
        <div style={{ fontSize:11, color:'var(--accent2)', letterSpacing:'0.08em', marginBottom:6 }}>{part.label}</div>
        <div style={{ fontSize:13, color:'var(--ink3)', marginBottom:14 }}>AI 生成咗以下內容，你可以直接編輯</div>
        <textarea value={edited} onChange={e => setEdited(e.target.value)} style={{ width:'100%', background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', padding:'14px 16px', fontSize:14, color:'var(--ink)', lineHeight:1.8, minHeight:100, resize:'vertical', fontFamily:'Inter, sans-serif', outline:'none', boxSizing:'border-box' }} />
      </div>
      <div style={{ fontSize:11, color:'var(--ink3)', marginBottom:4 }}>拍攝計劃（{part.shots.length} 個鏡頭）</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {part.shots.map((s, i) => (
          <div key={s.id} style={{ display:'flex', gap:10, alignItems:'flex-start', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px' }}>
            <div style={{ fontSize:11, fontWeight:500, color:'var(--accent2)', minWidth:20 }}>{i+1}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:500, color:'var(--ink)', marginBottom:2 }}>{s.shotType}</div>
              <div style={{ fontSize:12, color:'var(--ink3)' }}>{s.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:10, marginTop:'auto' }}>
        <button onClick={onSkip} style={{ flex:1, background:'none', border:'1px solid var(--border)', borderRadius:'var(--radius-pill)', padding:'13px', fontSize:13, color:'var(--ink3)', cursor:'pointer' }}>跳過</button>
        <button onClick={() => onConfirm(edited)} style={{ flex:2, background:'var(--accent)', border:'none', borderRadius:'var(--radius-pill)', padding:'13px', fontSize:14, fontWeight:500, color:'#fff', cursor:'pointer' }}>確認，開始拍攝 →</button>
      </div>
    </div>
  )
}

function ShootInner() {
  const params  = useSearchParams()
  const router  = useRouter()
  const topic   = params.get('topic')   || ''
  const address = params.get('address') || ''
  const scope   = params.get('scope')   || 'food'
  const mode    = params.get('mode')    || 'crew'
  const [step, setStep]       = useState<'hook'|'generating'|'shoot'>('hook')
  const [selHook, setSelHook] = useState(0)
  const [parts, setParts]     = useState<Part[]>([])
  const [partIdx, setPartIdx] = useState(0)
  const [shotIdx, setShotIdx] = useState(0)
  const hooks = HOOK_MAP[scope] || HOOK_MAP.food
  const scopeLabels: Record<string,string> = { food:'實測食物', general:'一般介紹', queue:'排隊實況', vlog:'個人 Vlog', chef:'廚師幕後', attraction:'景點體驗' }

  const splitIntoShots = (text: string, partId: string, types: string[]): Shot[] =>
    text.split(/[。！？]/).map(s => s.trim()).filter(s => s.length > 4).slice(0, 4).map((s, i) => ({
      id: `${partId}-s${i}`, text: s, shotType: types[i % types.length] || 'Medium Shot', shotDesc: '', recorded: false, skipped: false,
    }))

  const generatePlan = async () => {
    setStep('generating')
    try {
      const hook  = hooks[selHook]
      const trans = TRANS_MAP[scope]
      const end   = END_MAP[scope]
      const loc   = address ? `主題：${topic}\n地址：${address}` : `主題：${topic}`
      const modeLabel = mode === 'self' ? '自拍（前置鏡頭）' : '人幫拍（後置鏡頭）'
      const prompt = `你係 SOON Core AI，幫 creator 策劃短片拍攝計劃。
${loc}
角度：${scopeLabels[scope]}
拍攝方式：${modeLabel}
Hook 風格：${hook.code} ${hook.name}
重要：根據實際地址同地區生成內容，唔好假設係香港。
請輸出 JSON（唔好加任何其他文字）：
{"hookLine":"一句具體hook，廣東話口語","background":"60-80字廣東話背景介紹，3-4句","transition":"一句轉場旁白","tests":[{"label":"實測項目","vo":"試後一句旁白","price":"價錢"},{"label":"實測項目","vo":"試後一句旁白","price":"價錢"},{"label":"實測項目","vo":"試後一句旁白","price":"價錢"},{"label":"實測項目","vo":"試後一句旁白","price":"價錢"}],"ending":"一句收結旁白"}`
      const res  = await fetch('/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1200, messages:[{role:'user',content:prompt}] }) })
      const data = await res.json()
      const parsed = JSON.parse((data.content?.[0]?.text || '{}').replace(/```json|```/g,'').trim())
      const builtParts: Part[] = [
        { id:'hook', label:'Hook', type:'hook', subStep:'review', done:false, skipped:false, editableContent: parsed.hookLine || hook.teaser, shots:[{ id:'hook-s0', text: parsed.hookLine || hook.teaser, shotType: mode==='self'?'Medium Shot':'Wide Shot', shotDesc:'主角開場', recorded:false, skipped:false }] },
        { id:'bg', label:'背景介紹', type:'bg', subStep:'review', done:false, skipped:false, editableContent: parsed.background || '', shots: splitIntoShots(parsed.background || '', 'bg', ['Wide Shot','Medium Shot','B-roll']) },
        { id:'trans', label:'轉場', type:'trans', subStep:'review', done:false, skipped:false, editableContent: parsed.transition || trans.name, shots:[{ id:'trans-s0', text: parsed.transition || trans.name, shotType:'Medium Shot', shotDesc:'轉場', recorded:false, skipped:false }] },
        ...(parsed.tests || []).map((t: any, i: number): Part => ({ id:`test${i+1}`, label:`實測 ${i+1}`, type:'test', subStep:'review', done:false, skipped:false, editableContent: `${t.label}${t.price?' （'+t.price+'）':''}
${t.vo}`, shots:[{ id:`test${i+1}-s0`, text:t.label+(t.price?`（${t.price}）`:''), shotType:'產品特寫', shotDesc:'近鏡食物', recorded:false, skipped:false },{ id:`test${i+1}-s1`, text:t.vo, shotType:'反應鏡頭', shotDesc:'主持反應', recorded:false, skipped:false }] })),
        { id:'end', label:'Ending', type:'end', subStep:'review', done:false, skipped:false, editableContent: parsed.ending || end.name, shots:[{ id:'end-s0', text: parsed.ending || end.name, shotType:'Medium Shot', shotDesc:'收結', recorded:false, skipped:false }] },
      ]
      setParts(builtParts); setPartIdx(0); setShotIdx(0); setStep('shoot')
    } catch(e) { console.error(e) }
  }

  const currentPart = parts[partIdx]
  const currentShot = currentPart?.shots[shotIdx]
  const totalParts  = parts.length
  const doneParts   = parts.filter(p => p.done || p.skipped).length

  const confirmReview = (content: string) => { setParts(prev => prev.map((p,i) => i===partIdx ? {...p, editableContent:content, subStep:'camera'} : p)); setShotIdx(0) }
  const skipPart = () => { setParts(prev => prev.map((p,i) => i===partIdx ? {...p, skipped:true} : p)); setPartIdx(i => i+1); setShotIdx(0) }

  const advanceShot = (recorded: boolean, url: string) => {
    setParts(prev => prev.map((p,i) => {
      if (i !== partIdx) return p
      const newShots = p.shots.map((s,j) => j===shotIdx ? {...s, recorded, skipped:!recorded, videoUrl:url} : s)
      const allDone  = newShots.every(s => s.recorded || s.skipped)
      return { ...p, shots:newShots, done:allDone }
    }))
    if (shotIdx < (currentPart?.shots.length||1)-1) { setShotIdx(i => i+1) }
    else { setParts(prev => prev.map((p,i) => i===partIdx ? {...p, done:true} : p)); setPartIdx(i => i+1); setShotIdx(0) }
  }

  if (step === 'hook') return (
    <main style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--border)' }}>
        <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:'var(--ink3)', cursor:'pointer', fontSize:13 }}>← 返回</button>
        <span style={{ fontFamily:'EB Garamond, serif', fontSize:18 }}>SOON</span>
        <span style={{ fontSize:11, color:'var(--ink3)', letterSpacing:'0.08em' }}>1 / 3</span>
      </div>
      <div style={{ flex:1, padding:'28px 20px 40px', maxWidth:480, width:'100%', margin:'0 auto' }}>
        <h2 style={{ fontFamily:'EB Garamond, serif', fontSize:30, fontWeight:400, marginBottom:6 }}>揀你嘅開場方式</h2>
        <p style={{ fontSize:13, color:'var(--ink3)', marginBottom:24 }}>AI 根據「{scopeLabels[scope]}」揀咗 3 款</p>
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
          {hooks.map((h, i) => (
            <button key={h.code} onClick={() => setSelHook(i)} style={{ background:selHook===i?'var(--bg3)':'var(--bg2)', border:`1px solid ${selHook===i?'var(--accent)':'var(--border)'}`, borderRadius:'var(--radius)', padding:'14px 16px', textAlign:'left', cursor:'pointer', transition:'all 0.15s' }}>
              <div style={{ fontSize:10, color:selHook===i?'var(--accent2)':'var(--ink3)', letterSpacing:'0.1em', marginBottom:5 }}>{h.code}</div>
              <div style={{ fontSize:14, fontWeight:500, color:'var(--ink)', marginBottom:5 }}>{h.name}</div>
              <div style={{ fontSize:12, color:'var(--ink3)', lineHeight:1.5 }}>{h.teaser}</div>
            </button>
          ))}
        </div>
        <button onClick={generatePlan} style={{ width:'100%', background:'var(--accent)', border:'none', borderRadius:'var(--radius-pill)', padding:16, fontSize:15, fontWeight:500, color:'#fff', cursor:'pointer' }}>用呢個 Hook，AI 策劃 →</button>
      </div>
    </main>
  )

  if (step === 'generating') return (
    <main style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ width:32, height:32, border:'2px solid var(--border2)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <p style={{ color:'var(--ink3)', fontSize:14 }}>AI 策劃緊你嘅拍攝計劃…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  )

  if (partIdx >= totalParts && step === 'shoot') return (
    <main style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'center' }}>
        <span style={{ fontFamily:'EB Garamond, serif', fontSize:18 }}>SOON</span>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, padding:32 }}>
        <div style={{ fontSize:52, fontFamily:'EB Garamond, serif' }}>完成！</div>
        <p style={{ fontSize:14, color:'var(--ink3)', textAlign:'center', lineHeight:1.8 }}>拍咗 {parts.filter(p=>p.done).length} 個 part · 跳過 {parts.filter(p=>p.skipped).length} 個</p>
        {parts.some(p=>p.skipped) && <button onClick={() => { const i=parts.findIndex(p=>p.skipped); setPartIdx(i); setShotIdx(0) }} style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--radius-pill)', padding:'12px 24px', fontSize:13, color:'var(--ink)', cursor:'pointer' }}>補拍跳過嘅 part</button>}
        <button onClick={() => router.push('/')} style={{ background:'var(--accent)', border:'none', borderRadius:'var(--radius-pill)', padding:'14px 32px', fontSize:14, fontWeight:500, color:'#fff', cursor:'pointer' }}>拍新一條片</button>
      </div>
    </main>
  )

  return (
    <main style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'10px 20px 8px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', gap:3, marginBottom:5 }}>
          {parts.map((p,i) => <div key={p.id} style={{ flex:1, height:3, borderRadius:2, background:p.done?'var(--green)':p.skipped?'var(--border2)':i===partIdx?'var(--accent)':'var(--border)', transition:'background 0.3s' }} />)}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--ink3)' }}>
          <span>{doneParts} / {totalParts} part 完成</span>
          <span style={{ color:'var(--accent2)' }}>{currentPart?.label}{currentPart?.subStep==='camera'&&currentPart.shots.length>1?` · 鏡頭 ${shotIdx+1}/${currentPart.shots.length}`:''}</span>
        </div>
      </div>
      {currentPart?.subStep === 'review'
        ? <ReviewStep part={currentPart} onConfirm={confirmReview} onSkip={skipPart} />
        : currentPart?.subStep === 'camera' && currentShot
          ? <CameraView shotText={currentShot.text} shotType={currentShot.shotType} partLabel={currentPart.label} onSave={url => advanceShot(true, url)} onRetake={() => {}} onSkip={() => advanceShot(false, '')} />
          : null}
    </main>
  )
}

export default function Shoot() {
  return <Suspense><ShootInner /></Suspense>
}
