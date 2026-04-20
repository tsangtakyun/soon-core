'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, Suspense, useRef, useEffect, useCallback } from 'react'

const HOOK_MAP: Record<string, { name: string; teaser: string; example: string }[]> = {
  food: [
    { name: '直接挑戰', teaser: '質疑佢嘅名氣，幫觀眾驗證', example: '「呢間係咪真係咁出名？我今日幫你試過先。」' },
    { name: '感官喚起', teaser: '用香味／顏色勾起好奇心', example: '「條街都係香味，但係呢間有啲唔同……」' },
    { name: '反差驚喜', teaser: '外表平凡但質素出人意表', example: '「外面睇落普普通通，但係入到去……完全唔同世界。」' },
  ],
  general: [
    { name: '聽講引入', teaser: '借第三者說法引入懸念', example: '「聽講呢個地方有段唔為人知嘅故事……」' },
    { name: '荒誕事實', teaser: '真實但匪夷所思嘅背景', example: '「你估唔到呢度已經有幾多年歷史。」' },
    { name: '代入假設', teaser: '直問觀眾「如果你係…」', example: '「如果你今日只有一個鐘，你會點揀？」' },
  ],
  queue: [
    { name: '極端行動', teaser: '有人排足幾個鐘，值唔值？', example: '「有人為咗呢間排足三個鐘，你話值唔值？」' },
    { name: '親身測試', teaser: '我代你排隊，睇係咪值得', example: '「呢間係咪真係值得排咁耐？我今日親身測試。」' },
    { name: '出人意表', teaser: '以為係噱頭，原來有原因', example: '「以為係噱頭，但係個人龍……原來真係有原因。」' },
  ],
  vlog: [
    { name: '個人故事', teaser: '分享真實感受，拉近距離', example: '「我其實唔係專業 blogger，但係今日呢個地方令我改變咗睇法。」' },
    { name: '即場感受', teaser: '一入去就知道唔同', example: '「有啲地方，一入去就知道唔同——呢度就係其中一個。」' },
    { name: '邀請同行', teaser: '帶觀眾一齊去體驗', example: '「如果你今日唔知去邊，跟我去呢度就啱喇。」' },
  ],
  chef: [
    { name: '神秘故事', teaser: '廚師有段唔為人知嘅故事', example: '「呢個廚師有段故事，我等咗好耐先有機會採訪佢。」' },
    { name: '追夢故事', teaser: '放棄高薪追夢嘅真實故事', example: '「佢放棄咗一份高薪工，就係為咗呢個夢想。」' },
    { name: '幕後秘密', teaser: '凌晨三點開工嘅真相', example: '「每日凌晨三點，當你仲係瞓覺嘅時候，佢已經喺廚房開工。」' },
  ],
  attraction: [
    { name: '視覺衝擊', teaser: '有樣嘢你唔親眼見唔會信', example: '「呢度有樣嘢，你唔親眼見唔會信。」' },
    { name: '路過必入', teaser: '路過唔入會後悔', example: '「如果你只係路過呢度，你一定會後悔冇入去。」' },
    { name: '外表反差', teaser: '外面普通，入面另一個世界', example: '「外面睇落唔起眼，但係入到去……完全係另一個世界。」' },
  ],
}

const TRANS_MAP: Record<string, { name: string }> = {
  food: { name: '實測宣言 — 等我試下' },
  general: { name: '轉念 — 入去先信咗' },
  queue: { name: '情緒代入 — 同行感' },
  vlog: { name: '頓悟時刻' },
  chef: { name: '靈魂轉移 — 重點喺呢度' },
  attraction: { name: '場景切割 — 另有真相' },
}

const END_MAP: Record<string, { name: string }> = {
  food: { name: '值唔值得 — 親身作答' },
  general: { name: '留白式 Verdict' },
  queue: { name: '值唔值得 — 親身作答' },
  vlog: { name: '個人感悟 — 超越食玩' },
  chef: { name: '哲學收結' },
  attraction: { name: '詩意留白' },
}

type Shot = {
  id: string; text: string; shotType: string
  recorded: boolean; skipped: boolean; videoUrl?: string
}

type Part = {
  id: string; label: string; type: 'hook'|'bg'|'trans'|'test'|'end'
  subStep: 'review'|'camera'; editableContent: string
  shots: Shot[]; done: boolean; skipped: boolean
}

const recBtnStyle: React.CSSProperties = {
  width: 72, height: 72, borderRadius: '50%', border: '3px solid white',
  background: 'transparent', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}

// ─── Camera ───
function CameraView({ onSave, onSkip, shotText, shotType, partLabel }: {
  onSave: (url: string) => void; onSkip: () => void
  shotText: string; shotType: string; partLabel: string
}) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const reviewRef  = useRef<HTMLVideoElement>(null)
  const mediaRef   = useRef<MediaRecorder | null>(null)
  const chunksRef  = useRef<Blob[]>([])
  const streamRef  = useRef<MediaStream | null>(null)
  const [camState, setCamState] = useState<'preview'|'recording'|'review'>('preview')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [elapsed, setElapsed]   = useState(0)
  const [camError, setCamError] = useState('')
  const [facingMode, setFacingMode] = useState<'environment'|'user'>('environment')
  const [torchOn, setTorchOn]   = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCamera = useCallback(async (facing: 'environment'|'user' = facingMode) => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        await videoRef.current.play()
      }
      setCamError('')
    } catch (e: any) {
      setCamError('無法開啟鏡頭，請允許相機權限後重試。\n(' + (e.message || '') + ')')
    }
  }, [facingMode])

  useEffect(() => {
    startCamera()
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    await startCamera(next)
  }

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: !torchOn }] })
      setTorchOn(t => !t)
    } catch { /* torch not supported */ }
  }

  // Pick best supported mime type
  const getMimeType = () => {
    const types = ['video/mp4', 'video/webm;codecs=h264', 'video/webm;codecs=vp9', 'video/webm']
    return types.find(t => MediaRecorder.isTypeSupported(t)) || ''
  }

  const startRec = () => {
    if (!streamRef.current) return
    chunksRef.current = []
    const mime = getMimeType()
    const mr = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined)
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const mime2 = chunksRef.current[0]?.type || 'video/mp4'
      const blob  = new Blob(chunksRef.current, { type: mime2 })
      setRecordedBlob(blob)
      setCamState('review')
      // stop live stream
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
    mr.start()
    mediaRef.current = mr
    setCamState('recording')
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000)
  }

  const stopRec = () => {
    mediaRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
  }

  // Set review video source after blob is ready
  useEffect(() => {
    if (camState === 'review' && recordedBlob && reviewRef.current) {
      const url = URL.createObjectURL(recordedBlob)
      reviewRef.current.src = url
      reviewRef.current.load()
    }
  }, [camState, recordedBlob])

  const retake = async () => {
    setRecordedBlob(null)
    setCamState('preview')
    setElapsed(0)
    await startCamera()
  }

  const confirm = () => {
    if (!recordedBlob) return
    const url = URL.createObjectURL(recordedBlob)
    onSave(url)
  }

  const fmt = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`

  if (camError) return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:24 }}>
      <div style={{ fontSize:13, color:'var(--ink3)', textAlign:'center', lineHeight:1.7, whiteSpace:'pre-line' }}>{camError}</div>
      <button onClick={() => startCamera()} style={{ background:'var(--accent)', border:'none', borderRadius:'var(--radius-pill)', padding:'12px 24px', fontSize:13, color:'#fff', cursor:'pointer' }}>重試</button>
      <button onClick={onSkip} style={{ background:'none', border:'1px solid var(--border)', borderRadius:'var(--radius-pill)', padding:'10px 20px', fontSize:12, color:'var(--ink3)', cursor:'pointer' }}>跳過呢個鏡頭</button>
    </div>
  )

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
      {/* Shot info */}
      <div style={{ padding:'10px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:'var(--accent2)', marginBottom:2 }}>{partLabel} · {shotType}</div>
          <div style={{ fontSize:12, color:'var(--ink2)', lineHeight:1.5 }}>{shotText}</div>
        </div>
        {camState === 'recording' && (
          <div style={{ fontSize:13, color:'#E24B4A', fontVariantNumeric:'tabular-nums', marginLeft:12 }}>● {fmt(elapsed)}</div>
        )}
      </div>

      {/* Video area */}
      <div style={{ flex:1, position:'relative', background:'#000', margin:'10px 20px', borderRadius:'var(--radius)', overflow:'hidden', minHeight:260 }}>

        {/* Live preview */}
        {camState !== 'review' && (
          <video ref={videoRef} style={{ width:'100%', height:'100%', objectFit:'cover' }} playsInline muted />
        )}

        {/* Playback */}
        {camState === 'review' && (
          <video ref={reviewRef} style={{ width:'100%', height:'100%', objectFit:'cover' }} playsInline controls autoPlay />
        )}

        {/* Grid lines (preview/recording only) */}
        {camState !== 'review' && (
          <div style={{ position:'absolute', inset:0, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', pointerEvents:'none' }}>
            {[...Array(9)].map((_,i) => <div key={i} style={{ border:'0.5px solid rgba(255,255,255,0.12)' }} />)}
          </div>
        )}

        {/* Shot instruction */}
        {camState === 'preview' && (
          <div style={{ position:'absolute', top:0, left:0, right:0, padding:'10px 14px', background:'rgba(0,0,0,0.55)' }}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.9)' }}>{shotText}</div>
          </div>
        )}

        {/* Recording indicator */}
        {camState === 'recording' && (
          <div style={{ position:'absolute', top:12, left:14, display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#E24B4A', animation:'pulse 1s infinite' }} />
            <span style={{ fontSize:11, color:'#fff' }}>REC</span>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
          </div>
        )}

        {/* Camera controls (top right) — preview only */}
        {camState === 'preview' && (
          <div style={{ position:'absolute', top:10, right:12, display:'flex', flexDirection:'column', gap:8 }}>
            <button onClick={flipCamera} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(0,0,0,0.45)', border:'none', color:'#fff', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>⇄</button>
            <button onClick={toggleTorch} style={{ width:36, height:36, borderRadius:'50%', background: torchOn ? 'rgba(255,220,0,0.7)' : 'rgba(0,0,0,0.45)', border:'none', color:'#fff', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>☀</button>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{ padding:'4px 20px 24px' }}>
        {camState === 'preview' && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <button onClick={onSkip} style={{ background:'none', border:'1px solid var(--border)', borderRadius:'var(--radius-pill)', padding:'9px 16px', fontSize:12, color:'var(--ink3)', cursor:'pointer' }}>跳過</button>
            <button onClick={startRec} style={recBtnStyle}>
              <div style={{ width:48, height:48, borderRadius:'50%', background:'#E24B4A' }} />
            </button>
            <div style={{ width:72 }} />
          </div>
        )}
        {camState === 'recording' && (
          <div style={{ display:'flex', justifyContent:'center' }}>
            <button onClick={stopRec} style={recBtnStyle}>
              <div style={{ width:26, height:26, borderRadius:5, background:'#fff' }} />
            </button>
          </div>
        )}
        {camState === 'review' && (
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={retake} style={{ flex:1, background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--radius-pill)', padding:'13px', fontSize:14, color:'var(--ink)', cursor:'pointer' }}>重拍</button>
            <button onClick={confirm} style={{ flex:2, background:'var(--accent)', border:'none', borderRadius:'var(--radius-pill)', padding:'13px', fontSize:14, fontWeight:500, color:'#fff', cursor:'pointer' }}>確認用呢條 ✓</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Review Step ───
function ReviewStep({ part, onConfirm, onSkip }: {
  part: Part; onConfirm: (content: string) => void; onSkip: () => void
}) {
  const [edited, setEdited] = useState(part.editableContent)
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'20px 20px 32px', maxWidth:480, width:'100%', margin:'0 auto', gap:16, boxSizing:'border-box' }}>
      <div>
        <div style={{ fontSize:11, color:'var(--accent2)', letterSpacing:'0.08em', marginBottom:6 }}>{part.label}</div>
        <div style={{ fontSize:13, color:'var(--ink3)', marginBottom:12 }}>AI 生成咗以下內容，你可以直接編輯</div>
        <textarea
          value={edited}
          onChange={e => setEdited(e.target.value)}
          style={{ width:'100%', background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', padding:'14px 16px', fontSize:14, color:'var(--ink)', lineHeight:1.8, minHeight:90, resize:'vertical', fontFamily:'Inter, sans-serif', outline:'none', boxSizing:'border-box' }}
        />
      </div>
      <div>
        <div style={{ fontSize:11, color:'var(--ink3)', marginBottom:8 }}>拍攝計劃（{part.shots.length} 個鏡頭）</div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {part.shots.map((s, i) => (
            <div key={s.id} style={{ display:'flex', gap:10, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px' }}>
              <div style={{ fontSize:11, fontWeight:500, color:'var(--accent2)', minWidth:18 }}>{i+1}</div>
              <div>
                <div style={{ fontSize:12, fontWeight:500, color:'var(--ink)', marginBottom:2 }}>{s.shotType}</div>
                <div style={{ fontSize:12, color:'var(--ink3)' }}>{s.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', gap:10, marginTop:'auto' }}>
        <button onClick={onSkip} style={{ flex:1, background:'none', border:'1px solid var(--border)', borderRadius:'var(--radius-pill)', padding:'13px', fontSize:13, color:'var(--ink3)', cursor:'pointer' }}>跳過</button>
        <button onClick={() => onConfirm(edited)} style={{ flex:2, background:'var(--accent)', border:'none', borderRadius:'var(--radius-pill)', padding:'13px', fontSize:14, fontWeight:500, color:'#fff', cursor:'pointer' }}>確認，開始拍攝 →</button>
      </div>
    </div>
  )
}

// ─── Main ───
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
  const scopeLabels: Record<string,string> = {
    food:'實測食物', general:'一般介紹', queue:'排隊實況',
    vlog:'個人 Vlog', chef:'廚師幕後', attraction:'景點體驗',
  }

  const splitShots = (text: string, pid: string, types: string[]): Shot[] =>
    text.split(/[。！？]/).map(s => s.trim()).filter(s => s.length > 3).slice(0, 4)
      .map((s, i) => ({ id:`${pid}-s${i}`, text:s, shotType:types[i%types.length]||'Medium Shot', recorded:false, skipped:false }))

  const generatePlan = async () => {
    setStep('generating')
    try {
      const hook  = hooks[selHook]
      const trans = TRANS_MAP[scope]
      const end   = END_MAP[scope]
      const loc   = address ? `主題：${topic}\n地址：${address}` : `主題：${topic}`
      const ml    = mode === 'self' ? '自拍（前置鏡頭）' : '人幫拍（後置鏡頭）'

      const prompt = `你係 SOON Core AI，幫 creator 策劃短片拍攝計劃。
${loc}
角度：${scopeLabels[scope]}
拍攝方式：${ml}
Hook 風格：${hook.name}（${hook.teaser}）
重要：根據實際地址同地區生成內容，唔好假設係香港。
請輸出 JSON（唔好加任何其他文字）：
{"hookLine":"一句具體hook，廣東話口語","background":"60-80字廣東話背景介紹，3-4句","transition":"一句轉場旁白","tests":[{"label":"實測項目","vo":"試後一句旁白","price":"價錢"},{"label":"實測項目","vo":"試後一句旁白","price":"價錢"},{"label":"實測項目","vo":"試後一句旁白","price":"價錢"},{"label":"實測項目","vo":"試後一句旁白","price":"價錢"}],"ending":"一句收結旁白"}`

      const res  = await fetch('/api/generate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1200, messages:[{role:'user',content:prompt}] }),
      })
      const data   = await res.json()
      const parsed = JSON.parse((data.content?.[0]?.text||'{}').replace(/```json|```/g,'').trim())

      const builtParts: Part[] = [
        { id:'hook', label:'Hook', type:'hook', subStep:'review', done:false, skipped:false,
          editableContent: parsed.hookLine || hook.example,
          shots:[{ id:'hook-s0', text:parsed.hookLine||hook.example, shotType:mode==='self'?'Medium Shot':'Wide Shot', recorded:false, skipped:false }] },
        { id:'bg', label:'背景介紹', type:'bg', subStep:'review', done:false, skipped:false,
          editableContent: parsed.background||'',
          shots: splitShots(parsed.background||'', 'bg', ['Wide Shot','Medium Shot','B-roll']) },
        { id:'trans', label:'轉場', type:'trans', subStep:'review', done:false, skipped:false,
          editableContent: parsed.transition||trans.name,
          shots:[{ id:'trans-s0', text:parsed.transition||trans.name, shotType:'Medium Shot', recorded:false, skipped:false }] },
        ...(parsed.tests||[]).map((t:any, i:number): Part => ({
          id:`test${i+1}`, label:`實測 ${i+1}`, type:'test', subStep:'review', done:false, skipped:false,
          editableContent:`${t.label}${t.price?` （${t.price}）`:''}\n${t.vo}`,
          shots:[
            { id:`test${i+1}-s0`, text:t.label+(t.price?`（${t.price}）`:''), shotType:'產品特寫', recorded:false, skipped:false },
            { id:`test${i+1}-s1`, text:t.vo, shotType:'反應鏡頭', recorded:false, skipped:false },
          ],
        })),
        { id:'end', label:'Ending', type:'end', subStep:'review', done:false, skipped:false,
          editableContent:parsed.ending||end.name,
          shots:[{ id:'end-s0', text:parsed.ending||end.name, shotType:'Medium Shot', recorded:false, skipped:false }] },
      ]
      setParts(builtParts); setPartIdx(0); setShotIdx(0); setStep('shoot')
    } catch(e) { console.error(e); setStep('hook') }
  }

  const cur  = parts[partIdx]
  const shot = cur?.shots[shotIdx]
  const done = parts.filter(p => p.done||p.skipped).length

  const confirmReview = (content: string) => {
    setParts(prev => prev.map((p,i) => i===partIdx ? {...p, editableContent:content, subStep:'camera'} : p))
    setShotIdx(0)
  }
  const skipPart = () => {
    setParts(prev => prev.map((p,i) => i===partIdx ? {...p, skipped:true} : p))
    setPartIdx(i => i+1); setShotIdx(0)
  }
  const advance = (recorded: boolean, url: string) => {
    setParts(prev => prev.map((p,i) => {
      if (i!==partIdx) return p
      const shots = p.shots.map((s,j) => j===shotIdx ? {...s, recorded, skipped:!recorded, videoUrl:url} : s)
      return { ...p, shots, done: shots.every(s=>s.recorded||s.skipped) }
    }))
    if (shotIdx < (cur?.shots.length||1)-1) { setShotIdx(i=>i+1) }
    else { setParts(prev=>prev.map((p,i)=>i===partIdx?{...p,done:true}:p)); setPartIdx(i=>i+1); setShotIdx(0) }
  }

  // ── Hook screen ──
  if (step==='hook') return (
    <main style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--border)' }}>
        <button onClick={()=>router.push('/')} style={{ background:'none', border:'none', color:'var(--ink3)', cursor:'pointer', fontSize:13 }}>← 返回</button>
        <span style={{ fontFamily:'EB Garamond, serif', fontSize:18 }}>SOON</span>
        <div style={{ width:40 }} />
      </div>
      <div style={{ flex:1, padding:'28px 20px 40px', maxWidth:480, width:'100%', margin:'0 auto' }}>
        <h2 style={{ fontFamily:'EB Garamond, serif', fontSize:28, fontWeight:400, marginBottom:6 }}>揀你嘅開場方式</h2>
        <p style={{ fontSize:13, color:'var(--ink3)', marginBottom:24, lineHeight:1.6 }}>AI 根據「{scopeLabels[scope]}」揀咗 3 款開場，每款有唔同嘅感覺</p>
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
          {hooks.map((h, i) => (
            <button key={i} onClick={()=>setSelHook(i)} style={{ background:selHook===i?'var(--bg3)':'var(--bg2)', border:`1px solid ${selHook===i?'var(--accent)':'var(--border)'}`, borderRadius:'var(--radius)', padding:'14px 16px', textAlign:'left', cursor:'pointer', transition:'all 0.15s' }}>
              <div style={{ fontSize:14, fontWeight:500, color:'var(--ink)', marginBottom:4 }}>{h.name}</div>
              <div style={{ fontSize:12, color:selHook===i?'var(--ink2)':'var(--ink3)', fontStyle:'italic', marginBottom:6, lineHeight:1.5 }}>{h.example}</div>
              <div style={{ fontSize:11, color:'var(--ink3)' }}>{h.teaser}</div>
            </button>
          ))}
        </div>
        <button onClick={generatePlan} style={{ width:'100%', background:'var(--accent)', border:'none', borderRadius:'var(--radius-pill)', padding:16, fontSize:15, fontWeight:500, color:'#fff', cursor:'pointer' }}>
          用呢個開場，AI 策劃 →
        </button>
      </div>
    </main>
  )

  // ── Generating ──
  if (step==='generating') return (
    <main style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ width:32, height:32, border:'2px solid var(--border2)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <p style={{ color:'var(--ink3)', fontSize:14 }}>AI 策劃緊你嘅拍攝計劃…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  )

  // ── Finished ──
  if (partIdx>=parts.length && step==='shoot') return (
    <main style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'center' }}>
        <span style={{ fontFamily:'EB Garamond, serif', fontSize:18 }}>SOON</span>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, padding:32 }}>
        <div style={{ fontSize:52, fontFamily:'EB Garamond, serif' }}>完成！</div>
        <p style={{ fontSize:14, color:'var(--ink3)', textAlign:'center', lineHeight:1.8 }}>
          拍咗 {parts.filter(p=>p.done).length} 個 part<br/>跳過 {parts.filter(p=>p.skipped).length} 個 part
        </p>
        {parts.some(p=>p.skipped) && (
          <button onClick={()=>{const i=parts.findIndex(p=>p.skipped);setPartIdx(i);setShotIdx(0)}} style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--radius-pill)', padding:'12px 24px', fontSize:13, color:'var(--ink)', cursor:'pointer' }}>
            補拍跳過嘅 part
          </button>
        )}
        <button onClick={()=>router.push('/')} style={{ background:'var(--accent)', border:'none', borderRadius:'var(--radius-pill)', padding:'14px 32px', fontSize:14, fontWeight:500, color:'#fff', cursor:'pointer' }}>
          拍新一條片
        </button>
      </div>
    </main>
  )

  // ── Shoot ──
  return (
    <main style={{ minHeight:'100dvh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'10px 20px 8px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', gap:3, marginBottom:5 }}>
          {parts.map((p,i)=>(
            <div key={p.id} style={{ flex:1, height:3, borderRadius:2, transition:'background 0.3s',
              background:p.done?'var(--green)':p.skipped?'var(--border2)':i===partIdx?'var(--accent)':'var(--border)' }} />
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--ink3)' }}>
          <span>{done} / {parts.length} 完成</span>
          <span style={{ color:'var(--accent2)' }}>
            {cur?.label}{cur?.subStep==='camera'&&(cur.shots.length>1)?` · 鏡頭 ${shotIdx+1}/${cur.shots.length}`:''}
          </span>
        </div>
      </div>

      {cur?.subStep==='review'
        ? <ReviewStep part={cur} onConfirm={confirmReview} onSkip={skipPart} />
        : cur?.subStep==='camera' && shot
          ? <CameraView shotText={shot.text} shotType={shot.shotType} partLabel={cur.label} onSave={url=>advance(true,url)} onSkip={()=>advance(false,'')} />
          : null}
    </main>
  )
}

export default function Shoot() {
  return <Suspense><ShootInner /></Suspense>
}
