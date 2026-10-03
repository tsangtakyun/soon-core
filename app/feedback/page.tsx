import type { Metadata } from 'next'
import { Suspense } from 'react'

import { FeedbackHub } from '@/components/FeedbackHub'

import styles from './feedback.module.css'

export const metadata: Metadata = {
  title: '問題與建議｜SOON Core',
  description: '向 SOON 團隊提交產品問題及建議。',
}

export default function FeedbackPage() {
  return <Suspense><FeedbackHub styles={styles} /></Suspense>
}
