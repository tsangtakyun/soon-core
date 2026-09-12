import 'server-only'

import { createHash, timingSafeEqual } from 'node:crypto'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { STYLE_FORMATS, type PublishedStyle, type PublishedStylesResponse, type StyleFormat, type StyleRules } from '@/types/style-registry'

type StyleRow = { id: string; code: string; format: StyleFormat; name: string; description: string }
type VersionRow = { id: string; style_id: string; version: number; rules: StyleRules; content_hash: string; change_summary: string; published_at: string }

export function isStyleFormat(value: string | null): value is StyleFormat {
  return Boolean(value && STYLE_FORMATS.includes(value as StyleFormat))
}

export function authorisedStyleReader(request: Request) {
  const expected = process.env.SOON_CORE_BUNDLE_KEY || process.env.SOON_CORE_KNOWLEDGE_KEY
  const supplied = request.headers.get('x-soon-knowledge-key')
  if (!expected || !supplied) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(supplied)
  return a.length === b.length && timingSafeEqual(a, b)
}

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export async function loadPublishedStyles(filter: { format?: StyleFormat; code?: string } = {}): Promise<PublishedStylesResponse> {
  const admin = createSupabaseAdmin()
  let styleQuery = admin.from('content_styles').select('id,code,format,name,description').eq('status', 'active').in('scope', ['public_research', 'soon_owned']).order('code')
  if (filter.format) styleQuery = styleQuery.eq('format', filter.format)
  if (filter.code) styleQuery = styleQuery.eq('code', filter.code)
  const { data: styleData, error: styleError } = await styleQuery
  if (styleError) throw styleError
  const rows = (styleData ?? []) as StyleRow[]
  if (!rows.length) return emptyResponse(filter.format ?? null)

  const { data: versionData, error: versionError } = await admin.from('style_versions')
    .select('id,style_id,version,rules,content_hash,change_summary,published_at')
    .in('style_id', rows.map((row) => row.id)).eq('status', 'published').order('version', { ascending: false })
  if (versionError) throw versionError
  const latest = new Map<string, VersionRow>()
  for (const row of (versionData ?? []) as VersionRow[]) if (!latest.has(row.style_id)) latest.set(row.style_id, row)
  const versionIds = [...latest.values()].map((row) => row.id)
  const counts = new Map<string, number>()
  if (versionIds.length) {
    const { data, error } = await admin.from('style_references').select('style_version_id').in('style_version_id', versionIds)
      .eq('confirmation_status', 'confirmed').in('source_scope', ['public_research', 'soon_owned'])
    if (error) throw error
    for (const row of data ?? []) counts.set(row.style_version_id, (counts.get(row.style_version_id) ?? 0) + 1)
  }
  const styles: PublishedStyle[] = rows.flatMap((style) => {
    const version = latest.get(style.id)
    if (!version) return []
    return [{ styleId: style.id, code: style.code, format: style.format, name: style.name, description: style.description,
      version: { id: version.id, number: version.version, ref: `style:${style.code}:v${version.version}`, contentHash: version.content_hash,
        changeSummary: version.change_summary, publishedAt: version.published_at, rules: version.rules },
      evidence: { confirmedReferenceCount: counts.get(version.id) ?? 0 } }]
  })
  const contentHash = hash(styles)
  return { schemaVersion: 1, registryVersion: `styles-${contentHash.slice(0, 12)}`,
    compatibility: { minimumCreatorContract: 1, supportedFormats: STYLE_FORMATS }, format: filter.format ?? null,
    updatedAt: styles.reduce<string | null>((latestAt, item) => !latestAt || item.version.publishedAt > latestAt ? item.version.publishedAt : latestAt, null),
    contentHash, styles }
}

function emptyResponse(format: StyleFormat | null): PublishedStylesResponse {
  const styles: PublishedStyle[] = []
  const contentHash = hash(styles)
  return { schemaVersion: 1, registryVersion: `styles-${contentHash.slice(0, 12)}`, compatibility: { minimumCreatorContract: 1, supportedFormats: STYLE_FORMATS }, format, updatedAt: null, contentHash, styles }
}
