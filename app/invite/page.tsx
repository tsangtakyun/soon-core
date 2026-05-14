'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase'

type InviteState = {
  email: string
  role: string
  workspaceName: string
}

export default function InvitePage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [invite, setInvite] = useState<InviteState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadInvite() {
      const inviteToken = new URLSearchParams(window.location.search).get('token') ?? ''
      setToken(inviteToken)
      if (!inviteToken) {
        setError('邀請連結無效')
        setLoading(false)
        return
      }

      const response = await fetch(`/api/invite?token=${encodeURIComponent(inviteToken)}`)
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error || '邀請連結無效或已過期')
        setLoading(false)
        return
      }

      setInvite({
        email: payload.invitation.email,
        role: payload.invitation.role,
        workspaceName: payload.invitation.workspaces?.name ?? 'SOON CORE',
      })
      setLoading(false)
    }

    void loadInvite()
  }, [])

  async function acceptInvite() {
    setLoading(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/invite?token=${encodeURIComponent(token)}`,
        },
      })
      return
    }

    const response = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(payload.error || '接受邀請失敗')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-logo">⚡ SOON CORE</div>
        <h1>接受邀請</h1>
        {loading && <p>載入中...</p>}
        {error && <div className="login-error">{error}</div>}
        {invite && !error && (
          <>
            <p>
              你被邀請加入 <strong>{invite.workspaceName}</strong>，角色：{invite.role}
            </p>
            <button className="login-submit" type="button" disabled={loading} onClick={() => void acceptInvite()}>
              用 Google 登入並加入
            </button>
          </>
        )}
      </section>
    </main>
  )
}
