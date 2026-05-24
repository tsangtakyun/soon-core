import { Suspense } from 'react'

import { DealsCentre } from '@/components/DealsCentre'

export default function DealsPage() {
  return (
    <Suspense>
      <DealsCentre />
    </Suspense>
  )
}
