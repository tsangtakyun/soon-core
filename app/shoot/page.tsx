'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

const HOOK_MAP: Record<string, { code: string; name: string; preview: (topic: string) => string }[]> = {
  food: [
    { code: 'H2', name: '真定假 — 直接挑戰', preview: (t) => `「${t}真係香港第一？我今日幫你驗證。」` },
    { code: 'H4', name: '感官喚起 + 懸念',   preview: (t) => `「成條街都係香味……等陣你就知點解人人話${t}值得排。」` },
    { code: 'H5', name: '反差驚喜 — 竟然',   preview: (t) => `「${t}外表普普通通，但係個質素……竟然係咁。」` },
  ],
  general: [
    { code: 'H3', name: '聽講 — 半信半疑',   preview: (t) => `「聽講${t}係隱世神店，我今日幫你確認。」` },
    { code: 'H7', name: '荒誕事實',           preview: (t) => `「你估唔到${t}有幾多年歷史。」` },
    { code: 'H8', name: '代入感假設',         preview: (t) => `「如果你只有一個鐘去${t}，你會點揀？」` },
  ],
  queue: [
    { code: 'H1', name: '極端行動質問',       preview: (t) => `「有人為咗${t}排足三個鐘，你話值唔值？」` },
    { code: 'H2', name: '真定假 — 挑戰',      preview: (t) => `「${t}係咪真係值得排咁耐？我今日親身測試。」` },
    { code: 'H5', name: '反差驚喜',           preview: (t) => `「以為係噱頭，但係${t}個人龍……真係有原因。」` },
  ],
  vlog: [
    { code: 'H6', name: '意外自我披露',       preview: (t) => `「我其實唔係美食 blogger，但係${t}令我改變咗睇法。」` },
    { code: 'H4', name: '感官喚起',           preview: (t) => `「有啲地方，一入去就知道唔同——${t}就係其中一個。」` },
    { code: 'H8', name: '代入感假設',         preview: (t) => `「如果你今日唔知去邊，跟我去${t}就啱喇。」` },
  ],
  chef: [
    { code: 'H3', name: '聽講 — 懸念',       preview: (t) => `「聽講${t}個廚師有段唔為人知嘅故事。」` },
    { code: 'H6', name: '意外自我披露',       preview: (t) => `「佢放棄咗一份高薪工，就係為咗${t}呢個夢想。」` },
    { code: 'H7', name: '荒誕事實',           preview: (t) => `「${t}個廚師每日凌晨三點就開工——原因你估唔到。」` },
  ],
  attraction: [
    { code: 'H4', name: '感官喚起 + 懸念',   preview: (t) => `「${t}有樣嘢，你唔親眼見唔會信。」` },
    { code: 'H8', name: '代入感假設',         preview: (t) => `「如果你只係路過${t}，你一定會後悔冇入去。」` },
    { code: 'H5', name: '反差驚喜',           preview: (t) => `「${t}外面睇落普通，但係入到去……完全唔同世界。」` },
  ],
}

const TRANS_MAP: Record<string, { code: string; name: string }> = {
  food:       { code: 'T4', name: '實測宣言 — 等我試下' },
  general:    { code: 'T2', name: '轉念 — 入去先信咗' },
  queue:      { code: 'T1', name: '情緒代入 — 同行感' },
  vlog:       { code: 'T8', name: '頓悟時刻' },
  chef:       { code: 'T7', name: '靈魂轉移 — 重點喺呢度' },
  attraction: { code: 'T5', name: '場景切割 — 另有真相' },
}

const END_MAP: Record<string, { code: string; name: string }> = {
  food:       { code: 'E2', name: '值唔值得 — 親身作答' },
  general:    { code: 'E1', name: '留白式 Verdict' },
  queue:      { code: 'E2', name: '值唔值得 — 親身作答' },
  vlog:       { code: 'E6', name: '個人感悟 — 超越食玩' },
  chef:       { code: 'E7', name: '哲學收結' },
  attraction: { code: 'E5', name: '詩意留白' },
}

type Part = {
  id: string
  label: string
  type: 'hook' | 'bg' | 'trans' | 'test' | 'end'
  content?: string
  shot?: string
  price?: string
}

function ShootInner() {
  const params = useSearchParams()
  const router = useRouter()
  const topic  = params.get('topic') || ''
  const scope  = params.get('scope') || 'food'
  const mode   = params.get('mode')  || 'crew'

  const [step, setStep] = useState<'hook' | 'plan' | 'shoot'>('hook')
  const [selHook, setSelHook]   = useState(0)
  const [parts, setParts]       = useState<Part[]>([])
  const [current, setCurrent]   = useState(0)
  const [done, setDone]         = useState<Set<number>>(new Set())
  const [skipped, setSkipped]   = useState<Set<number>>(new Set())
  const [generating, setGenerating] = useState(false)

  const hooks = HOOK_MAP[scope] || HOOK_MAP.food

  const generatePlan = async () => {
    setGenerating(true)
    try {
      const scopeLabel: Record<string, string> = {
        food: '實測食物', general: '一般介紹', queue: '排隊實況',
        vlog: '個人 Vlog', chef: '廚師幕後', attraction: '景點體驗',
      }
      const modeLabel = mode === 'self' ? '自拍（前置鏡頭）' : '人幫拍（後置鏡頭）'
      const trans = TRANS_MAP[scope]
      const end   = END_MAP[scope]
      const hook  = hooks[selHook]

      const prompt = `你係 SOON Core AI，幫 creator 策劃短片拍攝計劃。
主題：${topic}
角度：${scopeLabel[scope]}
拍攝方式：${modeLabel}
Hook：${hook.code} ${hook.name}

請輸出 JSON，格式如下（唔好加任何其他文字）：
{
  "background": {
    "content": "50-80字廣東話背景介紹",
    "shot": "一句鏡頭指示"
  },
  "tests": [
    { "label": "實測項目名稱", "shot": "一句鏡頭指示", "content": "試後要講咩，一句", "price": "估計價錢或份量" },
    { "label": "實測項目名稱", "shot": "一句鏡頭指示", "content": "試後要講咩，一句", "price": "估計價錢或份量" },
    { "label": "實測項目名稱", "shot": "一句鏡頭指示", "content": "試後要講咩，一句", "price": "估計價錢或份量" },
    { "label": "實測項目名稱", "shot": "一句鏡頭指示", "content": "試後要講咩，一句", "price": "估計價錢或份量" }
  ]
}`

      const res  = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || '{}'
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())

      const builtParts: Part[] = [
        { id: 'hook',  label: 'Hook',   type: 'hook',  content: hook.preview(topic), shot: mode === 'self' ? '前置鏡頭對住自己，講出 hook' : '後置鏡頭拍主角走入場景' },
        { id: 'bg',    label: '背景介紹', type: 'bg',    content: parsed.background?.content, shot: parsed.background?.shot },
        { id: 'trans', label: '轉場',   type: 'trans', content: trans.name, shot: '快速剪接或走位轉場' },
        ...(parsed.tests || []).map((t: any, i: number) => ({
          id: `test${i+1}`, label: `實測 ${i+1}`, type: 'test' as const,
          content: t.content, shot: t.shot, price: `${t.label}${t.price ? ' · ' + t.price : ''}`,
        })),
        { id: 'end', label: 'Ending', type: 'end', content: end.name, shot: mode === 'self' ? '對鏡頭直接講感受' : '主角回望鏡頭，自然收結' },
      ]
      setParts(builtParts)
      setStep('shoot')
    } catch (e) {
      console.error(e)
    }
    setGenerating(false)
  }

  const partDone = (i: number) => { setDone(p => new Set([...p, i])); setCurrent(i + 1) }
  const partSkip = (i: number) => { setSkipped(p => new Set([...p, i])); setCurrent(i + 1) }

  if (step === 'hook') return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: '13px' }}>← 返回</button>
        <span style={{ fontFamily: 'EB Garamond, serif', fontSize: '18px' }}>SOON</span>
        <span style={{ fontSize: '11px', color: 'var(--ink3)', letterSpacing: '0.08em' }}>1 / 3</span>
      </div>
      <div style={{ flex: 1, padding: '28px 20px 40px', maxWidth: '480px', width: '100%', margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'EB Garamond, serif', fontSize: '30px', fontWeight: 400, marginBottom: '6px' }}>揀你嘅開場方式</h2>
        <p style={{ fontSize: '13px', color: 'var(--ink3)', marginBottom: '24px' }}>
          AI 根據「{({food:'實測食物',general:'一般介紹',queue:'排隊實況',vlog:'個人 Vlog',chef:'廚師幕後',attraction:'景點體驗'} as any)[scope]}」揀咗 3 款
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          {hooks.map((h, i) => (
            <button key={h.code} onClick={() => setSelHook(i)} style={{
              background: selHook === i ? 'var(--bg3)' : 'var(--bg2)',
              border: `1px solid ${selHook === i ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)', padding: '14px 16px',
              textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: '10px', color: selHook === i ? 'var(--accent2)' : 'var(--ink3)', letterSpacing: '0.1em', marginBottom: '5px' }}>{h.code}</div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', marginBottom: '5px' }}>{h.name}</div>
              <div style={{ fontSize: '13px', color: 'var(--ink2)', lineHeight: 1.6, fontStyle: 'italic' }}>{h.preview(topic)}</div>
            </button>
          ))}
        </div>
        <button onClick={() => { setStep('plan') }} style={{
          width: '100%', background: 'var(--accent)', border: 'none',
          borderRadius: 'var(--radius-pill)', padding: '16px',
          fontSize: '15px', fontWeight: 500, color: '#fff', cursor: 'pointer',
        }}>用呢個 Hook →</button>
        <button style={{
          width: '100%', background: 'none', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-pill)', padding: '13px',
          fontSize: '13px', color: 'var(--ink3)', cursor: 'pointer', marginTop: '10px',
        }}>自己寫 Hook</button>
      </div>
    </main>
  )

  if (step === 'plan') {
    if (!generating && parts.length === 0) generatePlan()
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--ink3)', fontSize: '14px' }}>AI 策劃緊你嘅拍攝計劃…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </main>
    )
  }

  const part = parts[current]
  const isFinished = current >= parts.length

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 20px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
          {parts.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: '3px', borderRadius: '2px',
              background: done.has(i) ? 'var(--green)' : skipped.has(i) ? 'var(--border2)' : i === current ? 'var(--accent)' : 'var(--border)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ink3)' }}>
          <span>第 {Math.min(current + 1, parts.length)} / {parts.length} part · 已拍 {done.size} 個</span>
          <span style={{ color: 'var(--accent2)' }}>{part?.label || '完成'}</span>
        </div>
      </div>

      {isFinished ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px 20px' }}>
          <div style={{ fontSize: '48px', fontFamily: 'EB Garamond, serif' }}>完成！</div>
          <p style={{ fontSize: '14px', color: 'var(--ink3)', textAlign: 'center', lineHeight: 1.7 }}>
            已拍 {done.size} 個 part，跳過 {skipped.size} 個。
          </p>
          {skipped.size > 0 && (
            <button onClick={() => setCurrent(parts.findIndex((_, i) => skipped.has(i)))} style={{
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-pill)', padding: '12px 24px',
              fontSize: '13px', color: 'var(--ink)', cursor: 'pointer',
            }}>補拍跳過嘅 part</button>
          )}
          <button onClick={() => router.push('/')} style={{
            background: 'var(--accent)', border: 'none',
            borderRadius: 'var(--radius-pill)', padding: '14px 32px',
            fontSize: '14px', fontWeight: 500, color: '#fff', cursor: 'pointer',
          }}>拍新一條片</button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'rgba(77,107,254,0.15)', color: 'var(--accent2)', marginBottom: '8px' }}>
              {part.label}
            </div>
            {part.price && <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)', marginBottom: '3px' }}>{part.price}</div>}
            {part.content && <div style={{ fontSize: '13px', color: 'var(--ink2)', lineHeight: 1.6, fontStyle: part.type === 'hook' ? 'italic' : 'normal' }}>{part.content}</div>}
          </div>
          <div style={{ flex: 1, position: 'relative', background: '#000', margin: '12px 20px', borderRadius: 'var(--radius)', overflow: 'hidden', minHeight: '320px' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', pointerEvents: 'none' }}>
              {[...Array(9)].map((_, i) => <div key={i} style={{ border: '0.5px solid rgba(255,255,255,0.1)' }} />)}
            </div>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '12px 14px', background: 'rgba(0,0,0,0.6)' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{part.shot}</div>
            </div>
            <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(77,107,254,0.8)', color: '#fff', fontSize: '10px', fontWeight: 500, padding: '3px 8px', borderRadius: '8px' }}>
              {part.label}
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity={0.2}>
                <rect x="2" y="10" width="30" height="22" rx="5" stroke="white" strokeWidth="2"/>
                <path d="M32 16l6-4v16l-6-4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ position: 'absolute', bottom: '16px', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
              <button onClick={() => partSkip(current)} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '11px' }}>跳</button>
              <button onClick={() => partDone(current)} style={{ width: '64px', height: '64px', borderRadius: '50%', border: '3px solid white', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#E24B4A' }} />
              </button>
              <button onClick={() => setCurrent(c => Math.max(0, c - 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '11px' }}>返</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default function Shoot() {
  return <Suspense><ShootInner /></Suspense>
}
