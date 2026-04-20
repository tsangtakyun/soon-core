'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SCOPES = [
  { id: 'general',     label: '一般介紹', sub: '環境 · 特色' },
  { id: 'food',        label: '實測食物', sub: '試食 · 評價' },
  { id: 'queue',       label: '排隊實況', sub: '等候 · 人氣' },
  { id: 'vlog',        label: '個人 Vlog', sub: '感受 · 故事' },
  { id: 'chef',        label: '廚師幕後', sub: '人物 · 理念' },
  { id: 'attraction',  label: '景點體驗', sub: '打卡 · 氛圍' },
]

const MODES = [
  {
    id: 'self',
    label: '自己拍',
    sub: '前置鏡頭，一個人搞掂',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 19c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'crew',
    label: '人幫你拍',
    sub: '後置鏡頭，更靈活',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="1" y="5" width="14" height="11" rx="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M15 9l4-2.5v7L15 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function Home() {
  const router = useRouter()
  const [topic, setTopic] = useState('')
  const [scope, setScope] = useState('')
  const [mode, setMode] = useState('')
  const [loading, setLoading] = useState(false)

  const ready = topic.trim() && scope && mode

  const handleStart = async () => {
    if (!ready || loading) return
    setLoading(true)
    const params = new URLSearchParams({ topic, scope, mode })
    router.push(`/shoot?${params}`)
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontFamily: 'EB Garamond, serif', fontSize: '20px', letterSpacing: '0.02em' }}>SOON</span>
        <span style={{
          fontSize: '11px',
          color: 'var(--ink3)',
          padding: '4px 10px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-pill)',
          letterSpacing: '0.08em',
        }}>CORE</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '32px 20px 40px', maxWidth: '480px', width: '100%', margin: '0 auto' }}>

        {/* Hero */}
        <div style={{ marginBottom: '36px' }}>
          <h1 style={{
            fontFamily: 'EB Garamond, serif',
            fontSize: '38px',
            fontWeight: 400,
            lineHeight: 1.15,
            marginBottom: '10px',
          }}>
            今日拍咩？
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--ink3)', lineHeight: 1.6 }}>
            輸入地點或主題，AI 幫你策劃成條片
          </p>
        </div>

        {/* Topic input */}
        <div style={{ marginBottom: '28px' }}>
          <label style={{ fontSize: '11px', color: 'var(--ink3)', letterSpacing: '0.1em', display: 'block', marginBottom: '10px' }}>
            地點 / 主題
          </label>
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="例：喜記茶餐廳，深水埗"
            style={{
              width: '100%',
              background: 'var(--bg2)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius)',
              padding: '14px 16px',
              fontSize: '15px',
              color: 'var(--ink)',
              outline: 'none',
              fontFamily: 'Inter, sans-serif',
            }}
          />
        </div>

        {/* Scope */}
        <div style={{ marginBottom: '28px' }}>
          <label style={{ fontSize: '11px', color: 'var(--ink3)', letterSpacing: '0.1em', display: 'block', marginBottom: '10px' }}>
            拍攝角度
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {SCOPES.map(s => (
              <button
                key={s.id}
                onClick={() => setScope(s.id)}
                style={{
                  background: scope === s.id ? 'var(--accent)' : 'var(--bg2)',
                  border: `1px solid ${scope === s.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: '12px 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: scope === s.id ? '#fff' : 'var(--ink)',
                  marginBottom: '3px',
                }}>{s.label}</div>
                <div style={{
                  fontSize: '11px',
                  color: scope === s.id ? 'rgba(255,255,255,0.7)' : 'var(--ink3)',
                }}>{s.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div style={{ marginBottom: '36px' }}>
          <label style={{ fontSize: '11px', color: 'var(--ink3)', letterSpacing: '0.1em', display: 'block', marginBottom: '10px' }}>
            拍攝方式
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                style={{
                  background: mode === m.id ? 'var(--bg3)' : 'var(--bg2)',
                  border: `1px solid ${mode === m.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: '14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  color: mode === m.id ? 'var(--accent2)' : 'var(--ink3)',
                  marginBottom: '8px',
                }}>{m.icon}</div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--ink)',
                  marginBottom: '3px',
                }}>{m.label}</div>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--ink3)',
                  lineHeight: 1.5,
                }}>{m.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleStart}
          disabled={!ready || loading}
          style={{
            width: '100%',
            background: ready ? 'var(--accent)' : 'var(--bg3)',
            border: `1px solid ${ready ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-pill)',
            padding: '16px',
            fontSize: '15px',
            fontWeight: 500,
            color: ready ? '#fff' : 'var(--ink3)',
            cursor: ready ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            letterSpacing: '0.02em',
          }}
        >
          {loading ? '策劃中…' : '開始策劃 →'}
        </button>

      </div>
    </main>
  )
}
