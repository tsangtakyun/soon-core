import 'server-only'

import { createHash, timingSafeEqual } from 'node:crypto'

export const templateTokenHash = (value: string) => createHash('sha256').update(value).digest('hex')

export function validTemplateToken(supplied: string | null, expectedHash: string) {
  if (!supplied || !expectedHash) return false
  const suppliedHash = Buffer.from(templateTokenHash(supplied))
  const expected = Buffer.from(expectedHash)
  return suppliedHash.length === expected.length && timingSafeEqual(suppliedHash, expected)
}

export const safePageRole = (value: unknown) => {
  const role = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return ['cover','longform','split','comparison','feature','end'].includes(role) ? role : null
}
