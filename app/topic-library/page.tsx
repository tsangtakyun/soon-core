import { Suspense } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import { TopicLibraryAdmin } from '@/components/TopicLibraryAdmin'

export default function TopicLibraryPage() {
  return (
    <Suspense>
      <DashboardShell activeSection="topics">
        <TopicLibraryAdmin />
      </DashboardShell>
    </Suspense>
  )
}
