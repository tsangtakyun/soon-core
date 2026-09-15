import 'server-only'

import { createHash, timingSafeEqual } from 'node:crypto'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { STYLE_FORMATS, type PublishedStyle, type PublishedStylesResponse, type PublishedTemplate, type StyleFormat, type StyleRules } from '@/types/style-registry'

type StyleRow = { id: string; code: string; format: StyleFormat; name: string; description: string }
type VersionRow = { id: string; style_id: string; version: number; rules: StyleRules; content_hash: string; change_summary: string; published_at: string }
type BindingRow = { style_version_id: string; template_version_id: string; priority: number }
type TemplateVersionRow = { id: string; template_id: string; version: number; renderer_code: string; contract: Record<string, unknown>; content_hash: string; creator_commit: string | null; published_at: string }
type TemplateRow = { id: string; code: string; name: string }

export function isStyleFormat(value: string | null): value is StyleFormat {
  return Boolean(value && STYLE_FORMATS.includes(value as StyleFormat))
}

export function authorisedStyleReader(request: Request) {
  const supplied = request.headers.get('x-soon-knowledge-key')
  if (!supplied) return false
  const provided = Buffer.from(supplied)
  return [process.env.SOON_CORE_BUNDLE_KEY, process.env.SOON_CORE_KNOWLEDGE_KEY].some((expected) => {
    if (!expected) return false
    const accepted = Buffer.from(expected)
    return accepted.length === provided.length && timingSafeEqual(accepted, provided)
  })
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
  const templatesByStyleVersion = new Map<string, PublishedTemplate[]>()
  if (versionIds.length) {
    const [{ data: referenceData, error: referenceError }, { data: bindingData, error: bindingError }] = await Promise.all([
      admin.from('style_references').select('style_version_id').in('style_version_id', versionIds)
        .eq('confirmation_status', 'confirmed').in('source_scope', ['public_research', 'soon_owned']),
      admin.from('style_template_bindings').select('style_version_id,template_version_id,priority').in('style_version_id', versionIds).eq('status', 'active').order('priority'),
    ])
    if (referenceError || bindingError) throw referenceError || bindingError
    for (const row of referenceData ?? []) counts.set(row.style_version_id, (counts.get(row.style_version_id) ?? 0) + 1)
    const bindings = (bindingData ?? []) as BindingRow[]
    const templateVersionIds = [...new Set(bindings.map((row) => row.template_version_id))]
    if (templateVersionIds.length) {
      const { data: templateVersionData, error } = await admin.from('template_versions')
        .select('id,template_id,version,renderer_code,contract,content_hash,creator_commit,published_at')
        .in('id', templateVersionIds).eq('status', 'published')
      if (error) throw error
      const templateVersions = (templateVersionData ?? []) as TemplateVersionRow[]
      const { data: templateData, error: templateError } = await admin.from('content_templates').select('id,code,name')
        .in('id', [...new Set(templateVersions.map((row) => row.template_id))]).eq('status', 'active').in('scope', ['public_research', 'soon_owned'])
      if (templateError) throw templateError
      const templateIdentities = new Map(((templateData ?? []) as TemplateRow[]).map((row) => [row.id, row]))
      const versionsById = new Map(templateVersions.map((row) => [row.id, row]))
      for (const binding of bindings) {
        const version = versionsById.get(binding.template_version_id)
        const template = version ? templateIdentities.get(version.template_id) : undefined
        if (!version || !template) continue
        const published: PublishedTemplate = { templateId: template.id, code: template.code, name: template.name,
          version: { id: version.id, number: version.version, ref: `template:${template.code}:v${version.version}`,
            rendererCode: version.renderer_code, contentHash: version.content_hash, creatorCommit: version.creator_commit,
            publishedAt: version.published_at, contract: version.contract } }
        templatesByStyleVersion.set(binding.style_version_id, [...(templatesByStyleVersion.get(binding.style_version_id) ?? []), published])
      }
    }
  }
  const styles: PublishedStyle[] = rows.flatMap((style) => {
    const version = latest.get(style.id)
    if (!version) return []
    return [{ styleId: style.id, code: style.code, format: style.format, name: style.name, description: style.description,
      version: { id: version.id, number: version.version, ref: `style:${style.code}:v${version.version}`, contentHash: version.content_hash,
        changeSummary: version.change_summary, publishedAt: version.published_at, rules: version.rules },
      evidence: { confirmedReferenceCount: counts.get(version.id) ?? 0 }, templates: templatesByStyleVersion.get(version.id) ?? [] }]
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
