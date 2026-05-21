'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function InviteClient() {
  const params = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }

    setStatus('loading')
    fetch('/api/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((response) => response.json())
      .then((data) => setStatus(data.ok ? 'success' : data.expired ? 'expired' : 'error'))
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
      }}
    >
      <div style={{ textAlign: 'center', color: '#fff', padding: '48px' }}>
        <h2 style={{ color: '#7c3aed', fontSize: '24px', marginBottom: '16px' }}>⚡ SOON Core</h2>
        {status === 'loading' && <p>驗證邀請中...</p>}
        {status === 'success' && (
          <>
            <p style={{ color: '#4ade80', fontSize: '18px' }}>✅ 邀請已接受！</p>
            <p style={{ color: '#999' }}>你已成功加入工作區。</p>
            <a
              href="/"
              style={{
                display: 'inline-block',
                marginTop: '24px',
                padding: '10px 24px',
                background: '#7c3aed',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
              }}
            >
              進入 SOON Core
            </a>
          </>
        )}
        {status === 'expired' && <p style={{ color: '#f87171' }}>邀請連結已過期或已使用。</p>}
        {status === 'error' && <p style={{ color: '#f87171' }}>無效邀請連結。</p>}
      </div>
    </div>
  )
}
