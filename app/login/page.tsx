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

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function signInWithPassword() {
    setLoading(true)
    setError('')
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setLoading(false)
      setError(signInError.message)
      return
    }

    await fetch('/api/auth/bootstrap', { method: 'POST' })
    setLoading(false)
    router.push('/')
    router.refresh()
  }

  async function signInWithGoogle() {
    setLoading(true)
    setError('')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
        <h1>歡迎回來</h1>
        <p>登入你的 SOON CORE 帳戶</p>

        <div className="login-form">
          <label>
            電郵地址
            <input value={email} type="email" autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            密碼
            <input value={password} type="password" autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className="login-forgot" type="button">
            忘記密碼？
          </button>
          <button className="login-submit" type="button" disabled={loading || !email || !password} onClick={() => void signInWithPassword()}>
            {loading ? '登入中...' : '登入 →'}
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="login-divider">或</div>
        <button className="login-google" type="button" disabled={loading} onClick={() => void signInWithGoogle()}>
          <GoogleIcon />
          Google 登入
        </button>
        <div className="login-note">
          未有帳戶？ <Link href="/register">立即註冊</Link>
        </div>
      </section>
    </main>
  )
}
