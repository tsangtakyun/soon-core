import 'server-only'

import { createHash, timingSafeEqual } from 'node:crypto'

export const APPROVED_VALIDATION_DRAFT_IDS = new Set([
  '2b1422f3-c42e-40d9-b7fe-632abc987797',
  '38cd6d9c-274f-4683-943a-b415fbdcd1bb',
  '3009c869-d6ac-42f1-b5d7-58cb4213e6cc',
  'b0243911-4944-4eb4-9875-83f7ab0e4633',
  '4bd2660a-1b13-4689-9780-4be8c3c129b0',
  '3788b82e-40ab-46bd-a227-d0f32ea721aa',
  '26ace544-0b9f-4047-bc75-ed8751c3d96c',
  'a0e92f7d-136d-410c-a287-6d4a456106f5',
  '96794188-4e0b-4807-8529-fe88cc062cbb',
  '08fcdb25-1de1-4338-b74d-4807b460d74a',
  'bbf884d2-a02e-4c9f-9f74-d816dc0a7399',
])

export const VALIDATION_TOKEN_TTL_MS = 2 * 60 * 1000

function matchesSecret(supplied: string | null, expected: string | undefined) {
  if (!supplied || !expected) return false
  const actual = Buffer.from(supplied)
  const accepted = Buffer.from(expected)
  return actual.length === accepted.length && timingSafeEqual(actual, accepted)
}

export function validValidationIssuer(request: Request) {
  return matchesSecret(request.headers.get('x-soon-validation-key'), process.env.SOON_CORE_VALIDATION_KEY)
}

export function validationTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function exactUpdatedAt(value: unknown) {
  if (typeof value !== 'string' || value.length > 64) return null
  return Number.isFinite(Date.parse(value)) ? value : null
}
