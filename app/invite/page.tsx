import { Suspense } from 'react'

import InviteClient from './InviteClient'

function InviteFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: '#fff',
      }}
    >
      驗證邀請中...
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={<InviteFallback />}>
      <InviteClient />
    </Suspense>
  )
}
