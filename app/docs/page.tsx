import { Suspense } from 'react'

import { DocsCenter } from '@/components/DocsCenter'

export default function DocsPage() {
  return (
    <Suspense>
      <DocsCenter />
    </Suspense>
  )
}
