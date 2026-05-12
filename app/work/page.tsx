import { Suspense } from 'react'

import { WorkBoard } from '@/components/WorkBoard'

export default function WorkPage() {
  return (
    <Suspense>
      <WorkBoard />
    </Suspense>
  )
}
