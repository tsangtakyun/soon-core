import { Suspense } from 'react'

import { HomeDashboard } from '@/components/HomeDashboard'

export default function Home() {
  return (
    <Suspense>
      <HomeDashboard />
    </Suspense>
  )
}
