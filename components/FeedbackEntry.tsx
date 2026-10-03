'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function FeedbackEntry() {
  const pathname = usePathname()
  if (pathname === '/feedback' || pathname === '/login' || pathname === '/register' || pathname.startsWith('/auth')) return null

  return (
    <Link
      href="/feedback"
      aria-label="問題與建議"
      style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        zIndex: 900,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        border: '1px solid rgba(196,151,255,.42)',
        borderRadius: 999,
        padding: '11px 15px',
        background: 'rgba(24,18,31,.94)',
        boxShadow: '0 12px 36px rgba(0,0,0,.32)',
        color: '#f4eaff',
        fontSize: 12,
        fontWeight: 700,
        textDecoration: 'none',
        backdropFilter: 'blur(12px)',
      }}
    >
      <span aria-hidden="true">◇</span>
      問題與建議
    </Link>
  )
}
