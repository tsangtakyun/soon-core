'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

function friendlyError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes('already') || lower.includes('registered')) return '電郵已被使用'
  return message || '註冊失敗'
}

export default function RegisterPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function validate() {
    if (!displayName.trim() || !email.trim() || !password || !confirmPassword || !workspaceName.trim()) return '請填寫所有欄位'
    if (password.length < 8) return '密碼最少需要8個字元'
    if (password !== confirmPassword) return '密碼唔符合'
    return ''
  }

  async function registerWithEmail() {
    setError('')
    setMessage('')
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName.trim(),
          full_name: displayName.trim(),
        },
      },
    })

    if (signUpError) {
      setLoading(false)
      setError(friendlyError(signUpError.message))
      return
    }

    if (!data.session) {
      setLoading(false)
      setMessage('註冊已建立。請先到電郵確認帳戶，再登入 SOON CORE。')
      return
    }

    const response = await fetch('/api/workspace/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceName: workspaceName.trim(), displayName: displayName.trim() }),
    })
    const payload = await response.json().catch(() => ({}))
    setLoading(false)

    if (!response.ok) {
      setError(payload.error || '建立工作區失敗')
      return
    }

    window.sessionStorage.setItem('soon-toast', `歡迎加入 SOON CORE，${displayName.trim()}！`)
    router.push('/')
    router.refresh()
  }

  async function registerWithGoogle() {
    setLoading(true)
    setError('')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/setup-workspace&skipBootstrap=1`,
      },
    })
    if (oauthError) {
      setLoading(false)
      setError(oauthError.message)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-logo">⚡ SOON CORE</div>
        <h1>建立帳戶</h1>
        <p>開始你的 SOON CORE 之旅</p>

        <div className="login-form">
          <label>
            你的名稱
            <input value={displayName} autoComplete="name" onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label>
            電郵地址
            <input value={email} type="email" autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            密碼
            <input value={password} type="password" minLength={8} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label>
            確認密碼
            <input value={confirmPassword} type="password" minLength={8} autoComplete="new-password" onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          <label>
            工作區名稱
            <input value={workspaceName} placeholder="例如：My Creative Studio" onChange={(event) => setWorkspaceName(event.target.value)} />
          </label>
          <button className="login-submit" type="button" disabled={loading} onClick={() => void registerWithEmail()}>
            {loading ? '建立中...' : '立即註冊 →'}
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}
        {message && <div className="login-message">{message}</div>}

        <div className="login-divider">或</div>
        <button className="login-google" type="button" disabled={loading} onClick={() => void registerWithGoogle()}>
          <GoogleIcon />
          Google 註冊
        </button>
        <div className="login-note">
          已有帳戶？ <Link href="/login">登入</Link>
        </div>
      </section>
    </main>
  )
}
