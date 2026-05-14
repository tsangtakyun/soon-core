import { Suspense } from 'react'

import { ReplyCentre } from '@/components/ReplyCentre'

export default function ReplyPage() {
  return (
    <Suspense>
      <ReplyCentre />
    </Suspense>
  )
}
