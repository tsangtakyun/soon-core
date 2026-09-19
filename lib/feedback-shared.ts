export const FEEDBACK_PRODUCTS = ['soon_creator', 'soon_egg', 'egg_app'] as const
export const FEEDBACK_STATUSES = ['pending_review', 'in_progress', 'pending_verification', 'resolved'] as const

export type FeedbackProduct = (typeof FEEDBACK_PRODUCTS)[number]
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export const FEEDBACK_PRODUCT_LABELS: Record<FeedbackProduct, string> = {
  soon_creator: 'SOON Creator',
  soon_egg: 'SOON EGG',
  egg_app: 'EGG App',
}

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  pending_review: '待查看',
  in_progress: '處理中',
  pending_verification: '待驗證',
  resolved: '已解決',
}
