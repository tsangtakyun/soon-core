export type TopicStatus = 'draft' | 'review' | 'published' | 'archived'

export type TopicDirection = {
  id: string
  parent_id: string | null
  label_zh: string
  label_en: string | null
  aliases: string[]
  sort_order: number
}

export type TopicSource = {
  id?: string
  url: string
  source_name?: string | null
  source_title?: string | null
  published_at?: string | null
  notes?: string | null
}

export type TopicItem = {
  id: string
  slug: string
  title: string
  summary: string
  why_now: string
  hook: string
  suggested_angles: string[]
  content_formats: string[]
  countries: string[]
  regions: string[]
  localities: string[]
  languages: string[]
  keywords: string[]
  cover_url: string | null
  cover_alt: string | null
  status: TopicStatus
  published_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
  topic_item_directions?: Array<{
    direction_id: string
    is_primary: boolean
    confidence: number | null
    topic_directions?: TopicDirection | null
  }>
  topic_sources?: TopicSource[]
}

export function cleanString(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function cleanStringArray(value: unknown, maxItems = 20, maxLength = 80) {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .map((item) => cleanString(item, maxLength))
    .filter(Boolean))]
    .slice(0, maxItems)
}

export function topicSlug(value: unknown) {
  const base = cleanString(value, 120)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)

  return base || `topic-${Date.now()}`
}

export function topicSelect() {
  return `
    *,
    topic_item_directions(
      direction_id,
      is_primary,
      confidence,
      topic_directions(id,parent_id,label_zh,label_en,aliases,sort_order)
    ),
    topic_sources(id,url,source_name,source_title,published_at,notes)
  `
}

export function publicTopicSelect() {
  return `
    id,slug,title,summary,why_now,hook,suggested_angles,content_formats,
    countries,regions,localities,languages,keywords,cover_url,cover_alt,
    published_at,expires_at,updated_at,
    topic_item_directions(
      direction_id,
      is_primary,
      topic_directions(id,parent_id,label_zh,label_en,aliases,sort_order)
    ),
    topic_sources(url,source_name,source_title,published_at)
  `
}
