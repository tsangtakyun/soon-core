import { Suspense } from 'react'

import { DashboardShell } from '@/components/DashboardShell'

export default function SchedulePage() {
  return (
    <Suspense>
      <DashboardShell activeSection="schedule">
        <section className="schedule-frame-page">
          <header className="schedule-frame-topbar">
            <h1>行程中心</h1>
            <span>Schedule</span>
          </header>
          <iframe
            src="https://prod-mgt.vercel.app/?embedded=true"
            title="行程中心"
            referrerPolicy="no-referrer-when-downgrade"
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        </section>
      </DashboardShell>
    </Suspense>
  )
}
