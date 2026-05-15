import { Suspense } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import PageHeader from '@/components/PageHeader'

export default function SchedulePage() {
  return (
    <Suspense>
      <DashboardShell activeSection="schedule">
        <section className="schedule-frame-page">
          <PageHeader icon="📅" title="行程中心" subtitle="管理拍攝行程同場景安排" />
          <iframe
            src="https://prod-mgt.vercel.app/?embedded=true"
            title="行程中心"
            referrerPolicy="no-referrer-when-downgrade"
            allow="clipboard-read; clipboard-write; fullscreen"
            style={{ width: '100%', height: 'calc(100vh - 48px - 73px)', border: 'none' }}
          />
        </section>
      </DashboardShell>
    </Suspense>
  )
}
