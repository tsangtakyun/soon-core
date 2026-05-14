'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase'

export default function SetupWorkspacePage() {
  const router = useRouter()
  const [workspaceName, setWorkspaceName] = useState('')
  const [displayName, setDisplayName] = useState('User')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        router.replace('/register')
        return
      }

      const response = await fetch('/api/team')
      const payload = await response.json().catch(() => ({}))
      if (response.ok && payload.activeWorkspaceId) {
        router.replace('/')
        return
      }

      const name =
        session.user.user_metadata?.display_name ||
        session.user.user_metadata?.full_name ||
        session.user.user_metadata?.name ||
        session.user.email?.split('@')[0] ||
        'User'
      setDisplayName(name)
      setWorkspaceName(`${name}'s Workspace`)
      setLoading(false)
    }

    void load()
  }, [router])

  async function createWorkspace() {
    if (!workspaceName.trim()) {
      setError('請填寫工作區名稱')
      return
    }

    setSaving(true)
    setError('')
    const response = await fetch('/api/workspace/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceName: workspaceName.trim(), displayName }),
    })
    const payload = await response.json().catch(() => ({}))
    setSaving(false)

    if (!response.ok) {
      setError(payload.error || '建立工作區失敗')
      return
    }

    window.sessionStorage.setItem('soon-toast', `歡迎加入 SOON CORE，${displayName}！`)
    router.push('/')
    router.refresh()
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-logo">⚡ SOON CORE</div>
        <h1>設定你的工作區</h1>
        <p>為你的 SOON CORE 建立一個工作區</p>

        {loading ? (
          <p>載入中...</p>
        ) : (
          <div className="login-form">
            <label>
              工作區名稱
              <input value={workspaceName} autoFocus onChange={(event) => setWorkspaceName(event.target.value)} />
            </label>
            <button className="login-submit" type="button" disabled={saving || !workspaceName.trim()} onClick={() => void createWorkspace()}>
              {saving ? '建立中...' : '開始使用 →'}
            </button>
          </div>
        )}

        {error && <div className="login-error">{error}</div>}
      </section>
    </main>
  )
}
