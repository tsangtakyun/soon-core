import { Suspense } from 'react'

import { FeedbackOnlyHome, HomeFeedbackBoard } from '@/components/HomeFeedbackBoard'
import { HomeDashboard } from '@/components/HomeDashboard'
import { requireFeedbackActor } from '@/lib/feedback-auth'

export default async function Home() {
  const actor = await requireFeedbackActor()
  if (actor?.feedbackOnly) return <FeedbackOnlyHome displayName={actor.displayName} />

  return (
    <>
      <Suspense>
        <HomeDashboard afterHero={<HomeFeedbackBoard />} />
      </Suspense>
    </>
  )
}
