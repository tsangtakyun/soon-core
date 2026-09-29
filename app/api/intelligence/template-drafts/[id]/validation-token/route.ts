import { randomBytes } from 'node:crypto'

import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { authorisedStyleReader } from '@/lib/style-registry'
import {
  APPROVED_VALIDATION_DRAFT_IDS,
  exactUpdatedAt,
  VALIDATION_TOKEN_TTL_MS,
  validationTokenHash,
  validValidationIssuer,
} from '@/lib/template-draft-validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const responseHeaders = { 'Cache-Control': 'no-store, max-age=0' }

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!authorisedStyleReader(request) || !validValidationIssuer(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: responseHeaders })
  }

  const { id } = await context.params
  if (!APPROVED_VALIDATION_DRAFT_IDS.has(id)) {
    return NextResponse.json({ error: 'Template draft not available for validation' }, { status: 404, headers: responseHeaders })
  }

  const admin = createSupabaseAdmin()
  const { data: draft, error: draftError } = await admin.from('template_master_drafts')
    .select('id,status,updated_at').eq('id', id).maybeSingle()
  if (draftError) return NextResponse.json({ error: 'Validation token unavailable' }, { status: 503, headers: responseHeaders })
  if (!draft) return NextResponse.json({ error: 'Template draft not found' }, { status: 404, headers: responseHeaders })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const suppliedUpdatedAt = body.expectedUpdatedAt === undefined
    ? null
    : exactUpdatedAt(body.expectedUpdatedAt)
  if (body.expectedUpdatedAt !== undefined && !suppliedUpdatedAt) {
    return NextResponse.json({ error: 'Invalid expectedUpdatedAt' }, { status: 400, headers: responseHeaders })
  }
  const expectedUpdatedAt = suppliedUpdatedAt || draft.updated_at
  if (draft.status !== 'review' || draft.updated_at !== expectedUpdatedAt) {
    return NextResponse.json({ error: 'Template draft revision changed or is not reviewable' }, { status: 409, headers: responseHeaders })
  }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + VALIDATION_TOKEN_TTL_MS).toISOString()
  const { data: issued, error } = await admin.rpc('issue_template_draft_validation_token', {
    p_draft_id: id,
    p_token_hash: validationTokenHash(token),
    p_expected_updated_at: expectedUpdatedAt,
    p_expires_at: expiresAt,
  })
  if (error) return NextResponse.json({ error: 'Validation token unavailable' }, { status: 503, headers: responseHeaders })
  if (issued !== true) return NextResponse.json({ error: 'Template draft revision changed or is not reviewable' }, { status: 409, headers: responseHeaders })

  return NextResponse.json({ token, draftId: id, updatedAt: expectedUpdatedAt, expiresAt }, { headers: responseHeaders })
}
