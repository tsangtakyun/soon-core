import 'server-only'

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

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
  'a5b258e2-a7b1-4340-a9f6-debe3629bfae',
  'e81923c1-a5d1-4a67-a9bb-9b275da8bd89',
  'b135a39d-bfd5-446c-b060-0d4f5bf6d3a8',
])

export const VALIDATION_TOKEN_TTL_MS = 2 * 60 * 1000

export const SIGNED_VALIDATION_DRAFT_IDS = new Set([
  'a5b258e2-a7b1-4340-a9f6-debe3629bfae',
  'e81923c1-a5d1-4a67-a9bb-9b275da8bd89',
  'b135a39d-bfd5-446c-b060-0d4f5bf6d3a8',
])

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

type SignedValidationPayload = {
  draftId: string
  updatedAt: string
  expiresAt: string
  nonce: string
}

function validationSigningKey() {
  return process.env.SOON_CORE_VALIDATION_KEY || ''
}

function signature(value: string) {
  return createHmac('sha256', validationSigningKey()).update(value).digest('base64url')
}

export function issueSignedValidationToken(draftId: string, updatedAt: string, expiresAt: string) {
  if (!validationSigningKey() || !SIGNED_VALIDATION_DRAFT_IDS.has(draftId)) return null
  const payload: SignedValidationPayload = {
    draftId,
    updatedAt,
    expiresAt,
    nonce: randomBytes(16).toString('base64url'),
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encoded}.${signature(encoded)}`
}

export function validSignedValidationToken(token: string, draftId: string, updatedAt: string) {
  if (!validationSigningKey() || !SIGNED_VALIDATION_DRAFT_IDS.has(draftId) || token.length > 1024) return false
  const [encoded, suppliedSignature, extra] = token.split('.')
  if (!encoded || !suppliedSignature || extra) return false
  const expectedSignature = signature(encoded)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedValidationPayload
    const expiresAt = Date.parse(payload.expiresAt)
    return payload.draftId === draftId
      && payload.updatedAt === updatedAt
      && Number.isFinite(expiresAt)
      && expiresAt > Date.now()
      && expiresAt <= Date.now() + VALIDATION_TOKEN_TTL_MS
      && typeof payload.nonce === 'string'
      && payload.nonce.length >= 16
  } catch {
    return false
  }
}

export function exactUpdatedAt(value: unknown) {
  if (typeof value !== 'string' || value.length > 64) return null
  return Number.isFinite(Date.parse(value)) ? value : null
}
