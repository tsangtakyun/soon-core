import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { requireCoreAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

type MetricValue = number | null
type CountFilter =
  | { kind: 'eq'; column: string; value: string | boolean }
  | { kind: 'in'; column: string; values: string[] }
  | { kind: 'not-null'; column: string }
  | { kind: 'lte'; column: string; value: string }

async function countRows(client: SupabaseClient, table: string, filters: CountFilter[] = []): Promise<MetricValue> {
  let query = client.from(table).select('*', { count: 'exact', head: true })
  for (const filter of filters) {
    if (filter.kind === 'eq') query = query.eq(filter.column, filter.value)
    if (filter.kind === 'in') query = query.in(filter.column, filter.values)
    if (filter.kind === 'not-null') query = query.not(filter.column, 'is', null)
    if (filter.kind === 'lte') query = query.lte(filter.column, filter.value)
  }
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

function optionalClient(url?: string, key?: string) {
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET() {
  const auth = await requireCoreAdmin()
  if (!auth.isAdmin) return NextResponse.json({ error: '沒有管理權限' }, { status: 403 })

  const core = createSupabaseAdmin()
  const brand = optionalClient(process.env.SOON_BRAND_SUPABASE_URL, process.env.SOON_BRAND_SUPABASE_SERVICE_ROLE_KEY)
  const egg = optionalClient(process.env.SOON_EGG_SUPABASE_URL, process.env.SOON_EGG_SUPABASE_SERVICE_ROLE_KEY)
  const sources = {
    core: { status: 'connected', message: '' },
    brand: { status: brand ? 'connected' : 'not_configured', message: brand ? '' : '未設定品牌端連線' },
    egg: { status: egg ? 'connected' : 'not_configured', message: egg ? '' : '未設定 EGG 連線' },
  }
  const coreMetrics = { topicsPublished: null as MetricValue, contentDirections: null as MetricValue, contentMethods: null as MetricValue, campaignLearnings: null as MetricValue }
  const brandMetrics = { brands: null as MetricValue, campaigns: null as MetricValue, connectedAccounts: null as MetricValue }
  const eggMetrics = { creators: null as MetricValue, connectedCreators: null as MetricValue }

  try {
    const values = await Promise.all([
      countRows(core, 'topic_items', [{ kind: 'eq', column: 'status', value: 'published' }]),
      countRows(core, 'docs', [{ kind: 'eq', column: 'template_type', value: 'content_direction' }]),
      countRows(core, 'docs', [{ kind: 'eq', column: 'template_type', value: 'content_method' }]),
      countRows(core, 'docs', [{ kind: 'eq', column: 'template_type', value: 'campaign_experience' }]),
    ])
    ;[coreMetrics.topicsPublished, coreMetrics.contentDirections, coreMetrics.contentMethods, coreMetrics.campaignLearnings] = values
  } catch (error) {
    Object.assign(sources.core, { status: 'error', message: error instanceof Error ? error.message : 'Core 資料讀取失敗' })
  }

  if (brand) {
    try {
      const values = await Promise.all([countRows(brand, 'brand_profiles'), countRows(brand, 'marketing_campaigns'), countRows(brand, 'social_connections')])
      ;[brandMetrics.brands, brandMetrics.campaigns, brandMetrics.connectedAccounts] = values
    } catch (error) {
      Object.assign(sources.brand, { status: 'error', message: error instanceof Error ? error.message : '品牌端資料讀取失敗' })
    }
  }

  if (egg) {
    try {
      const values = await Promise.all([countRows(egg, 'egg_creator_profiles'), countRows(egg, 'egg_creator_profiles', [{ kind: 'not-null', column: 'instagram_handle' }])])
      ;[eggMetrics.creators, eggMetrics.connectedCreators] = values
    } catch (error) {
      Object.assign(sources.egg, { status: 'error', message: error instanceof Error ? error.message : 'EGG 資料讀取失敗' })
    }
  }

  return NextResponse.json({ generatedAt: new Date().toISOString(), sources, metrics: { core: coreMetrics, brand: brandMetrics, egg: eggMetrics } })
}
