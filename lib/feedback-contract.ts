import { createHash, randomBytes } from 'node:crypto'

import { FEEDBACK_PRODUCTS, FEEDBACK_STATUSES, type FeedbackProduct, type FeedbackStatus } from '@/lib/feedback-shared'

export { FEEDBACK_PRODUCT_LABELS, FEEDBACK_PRODUCTS, FEEDBACK_STATUS_LABELS, FEEDBACK_STATUSES } from '@/lib/feedback-shared'
export type { FeedbackProduct, FeedbackStatus } from '@/lib/feedback-shared'

export const SCREENSHOT_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const AUDIO_MIME_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/webm', 'audio/ogg'])
export const GENERAL_FILE_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])
export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024
export const MAX_GENERAL_FILE_BYTES = 20 * 1024 * 1024
export const MAX_SCREENSHOTS = 3
export const MAX_GENERAL_FILES = 3

export function isFeedbackProduct(value: unknown): value is FeedbackProduct {
  return typeof value === 'string' && FEEDBACK_PRODUCTS.includes(value as FeedbackProduct)
}

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === 'string' && FEEDBACK_STATUSES.includes(value as FeedbackStatus)
}

export function cleanOptionalText(value: unknown, maxLength: number) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text ? text.slice(0, maxLength) : null
}

export function normalizeFeedbackText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function buildFeedbackDedupeHash(input: { reporterUserId: string; product: FeedbackProduct; description: string; problemUrl?: string | null }) {
  return createHash('sha256')
    .update([input.reporterUserId, input.product, normalizeFeedbackText(input.description), normalizeFeedbackText(input.problemUrl ?? '')].join('|'))
    .digest('hex')
}

export function buildFeedbackReference(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '')
  return `SOON-${date}-${randomBytes(3).toString('hex').toUpperCase()}`
}

export function safeFeedbackFilename(filename: string) {
  const cleaned = filename.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-100)
  return cleaned || 'attachment'
}

export function sha256Buffer(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}
