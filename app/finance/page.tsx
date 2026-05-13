import { Suspense } from 'react'

import { FinanceCenter } from '@/components/FinanceCenter'

export default function FinancePage() {
  return (
    <Suspense>
      <FinanceCenter />
    </Suspense>
  )
}
