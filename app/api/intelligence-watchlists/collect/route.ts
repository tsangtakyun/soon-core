import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requireCoreAdmin } from '@/lib/admin-auth'
import { classifyIndustryCandidates } from '@/lib/intelligence-industry-classifier'
import { captureHash, collectWatchlist, type WatchlistRow } from '@/lib/intelligence-watchlist'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const maxDuration = 300

type EggProfile = { instagram_access_token: string | null; instagram_user_id: string | null }

async function eggCredentials(admin: ReturnType<typeof createSupabaseAdmin>, workspaceId: string) {
  const url = process.env.SOON_EGG_SUPABASE_URL
  const key = process.env.SOON_EGG_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return {}
  const { data: link } = await admin.from('external_workspace_links').select('external_workspace_id').eq('core_workspace_id', workspaceId).eq('source_system', 'soon-egg').eq('active', true).maybeSingle()
  if (!link?.external_workspace_id) return {}
  const egg = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data } = await egg.from('egg_creator_profiles').select('instagram_access_token,instagram_user_id').eq('id', link.external_workspace_id).maybeSingle()
  const profile = data as EggProfile | null
  return profile?.instagram_access_token ? { instagramAccessToken: profile.instagram_access_token, instagramUserId: profile.instagram_user_id ?? undefined, facebookPageAccessToken: profile.instagram_access_token } : {}
}

async function runCollection(watchlistId?: string) {
  const admin = createSupabaseAdmin()
  let query = admin.from('intelligence_watchlists').select('*').eq('active', true)
  if (watchlistId) query = query.eq('id', watchlistId)
  const { data, error } = await query
  if (error) throw error
  let captured = 0
  const results: Array<{ id: string; status: string; count: number; error?: string }> = []
  for (const row of (data ?? []) as WatchlistRow[]) {
    try {
      const credentials = await eggCredentials(admin, row.workspace_id)
      const items = await collectWatchlist(row, credentials)
      const classifications = await classifyIndustryCandidates(items.map((item) => ({ key: item.platformItemId, text: item.contentText, sourceAccount: item.sourceAccount, sourceCodes: row.industry_codes })))
      const records = items.map((item) => {
        const classification = classifications.get(item.platformItemId)
        return { workspace_id: row.workspace_id, watchlist_id: row.id, platform: row.platform, platform_item_id: item.platformItemId, source_url: item.sourceUrl, source_account: item.sourceAccount || null, content_text: item.contentText || null, media_type: item.mediaType || null, thumbnail_url: item.thumbnailUrl || null, media_children: item.mediaChildren, published_at: item.publishedAt || null, source_scope: row.consent_basis === 'public_research' ? 'public_research' : 'workspace_private', industry_codes: row.industry_codes ?? [], primary_industry_code: classification?.primaryIndustryCode ?? null, secondary_industry_codes: classification?.secondaryIndustryCodes ?? [], industry_confidence: classification?.confidence ?? 0, industry_classification_status: classification?.status ?? 'needs_review', industry_classified_at: new Date().toISOString(), raw_payload: item.rawPayload, content_hash: captureHash(item) }
      })
      if (records.length) {
        // Updating a previously captured item backfills carousel children while
        // deliberately omitting review_status so editorial decisions survive.
        let { data: inserted, error: insertError } = await admin.from('intelligence_inbox_items').upsert(records, { onConflict: 'workspace_id,platform,platform_item_id' }).select('id')
        if (insertError && /media_children/i.test(insertError.message)) {
          // Rolling-deploy safety: retain children in raw_payload until the
          // additive database migration reaches this environment.
          const legacyRecords = records.map(({ media_children, ...record }) => {
            void media_children
            return record
          })
          const fallback = await admin.from('intelligence_inbox_items').upsert(legacyRecords, { onConflict: 'workspace_id,platform,platform_item_id' }).select('id')
          inserted = fallback.data
          insertError = fallback.error
        }
        if (insertError) throw insertError
        captured += inserted?.length ?? 0
      }
      await admin.from('intelligence_watchlists').update({ last_collected_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq('id', row.id)
      results.push({ id: row.id, status: 'ok', count: records.length })
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : '同步失敗'
      await admin.from('intelligence_watchlists').update({ last_collected_at: new Date().toISOString(), last_error: message, updated_at: new Date().toISOString() }).eq('id', row.id)
      results.push({ id: row.id, status: 'error', count: 0, error: message })
    }
  }
  return { captured, results }
}

async function reclassifyCandidates(workspaceId: string) {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin.from('intelligence_inbox_items')
    .select('id,content_text,source_account,industry_codes')
    .eq('workspace_id', workspaceId)
    .in('review_status', ['new', 'reviewing'])
    .order('captured_at', { ascending: false })
    .limit(300)
  if (error) throw error
  let classified = 0
  const rows = data ?? []
  for (let offset = 0; offset < rows.length; offset += 50) {
    const batch = rows.slice(offset, offset + 50)
    const results = await classifyIndustryCandidates(batch.map((item) => ({ key: item.id, text: item.content_text, sourceAccount: item.source_account, sourceCodes: item.industry_codes })))
    const updates = batch.map((item) => {
      const result = results.get(item.id)
      return admin.from('intelligence_inbox_items').update({
        primary_industry_code: result?.primaryIndustryCode ?? null,
        secondary_industry_codes: result?.secondaryIndustryCodes ?? [],
        industry_confidence: result?.confidence ?? 0,
        industry_classification_status: result?.status ?? 'needs_review',
        industry_classified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', item.id).eq('workspace_id', workspaceId)
    })
    const settled = await Promise.all(updates)
    const updateError = settled.find((result) => result.error)?.error
    if (updateError) throw updateError
    classified += batch.length
  }
  return { classified }
}

export async function POST(request: Request) {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin || !auth.userId) return NextResponse.json({ error: '沒有管理權限' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as { id?: string; action?: string }
  if (body.action === 'reclassify') {
    const admin = createSupabaseAdmin()
    const { data } = await admin.from('workspace_members').select('workspace_id').eq('user_id', auth.userId).eq('status', 'active').limit(1).maybeSingle()
    if (!data?.workspace_id) return NextResponse.json({ error: '找不到工作空間' }, { status: 404 })
    return NextResponse.json(await reclassifyCandidates(String(data.workspace_id)))
  }
  return NextResponse.json(await runCollection(body.id))
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await runCollection())
}
