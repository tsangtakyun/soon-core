import { Suspense } from 'react'

import { ContentDirectionLab } from '@/components/ContentDirectionLab'
import { DashboardShell } from '@/components/DashboardShell'

export default function ContentDirectionsPage() {
  return <Suspense><DashboardShell activeSection="directions"><ContentDirectionLab /></DashboardShell></Suspense>
}
