'use client'

import { Suspense, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import PageHeader from '@/components/PageHeader'

export default function SchedulePage() {
  const [iframeError, setIframeError] = useState(false)

  return (
    <Suspense>
      <DashboardShell activeSection="schedule">
        <section className="schedule-frame-page">
          <PageHeader icon="✈️" title="行程中心" subtitle="管理拍攝行程同場景安排" />

          {iframeError ? (
            <div
              style={{
                height: 'calc(100vh - 48px - 73px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '12px',
                border: '1px solid var(--soon-border)',
                borderRadius: '12px',
                background: 'var(--soon-surface)',
                color: 'var(--soon-text)',
                padding: '24px',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>行程中心載入失敗</p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--soon-text-secondary)' }}>
                請直接打開 prod-mgt.vercel.app，或重新整理頁面再試。
              </p>
              <a
                href="https://prod-mgt.vercel.app"
                target="_blank"
                rel="noreferrer"
                style={{
                  marginTop: '4px',
                  color: '#fff',
                  background: 'var(--soon-purple)',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  textDecoration: 'none',
                }}
              >
                打開行程中心
              </a>
            </div>
          ) : (
            <iframe
              src="https://prod-mgt.vercel.app?embedded=true"
              title="行程中心"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer-when-downgrade"
              allow="clipboard-read; clipboard-write; fullscreen"
              onError={() => setIframeError(true)}
              style={{ width: '100%', height: 'calc(100vh - 48px - 73px)', border: 'none' }}
            />
          )}
        </section>
      </DashboardShell>
    </Suspense>
  )
}
