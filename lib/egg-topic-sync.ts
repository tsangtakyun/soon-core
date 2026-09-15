import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { cleanString, cleanStringArray } from '@/lib/topic-library'

const EGG_TOPICS_URL = 'https://egg.sooncreator.network/api/public/topics'

type EggTopic = {
  id?: unknown; title?: unknown; summary?: unknown; content_formats?: unknown; keywords?: unknown;
  cover_url?: unknown; published_at?: unknown;
  topic_item_directions?: Array<{ is_primary?: boolean; topic_directions?: { label_zh?: unknown } | null }>;
  topic_sources?: Array<{ url?: unknown; source_name?: unknown }>;
}

function directionFor(topic: EggTopic) {
  const label = cleanString(topic.topic_item_directions?.find((item) => item.is_primary)?.topic_directions?.label_zh, 80)
  const text = `${label} ${cleanStringArray(topic.keywords).join(' ')} ${cleanString(topic.title, 180)}`
  if (/美食|餐廳|飲食|料理/.test(text)) return 'food'
  if (/旅遊|旅行|城市攻略/.test(text)) return 'travel'
  if (/娛樂|影視|電影|音樂|名人/.test(text)) return 'entertainment'
  if (/品牌|商業|創作|社交媒體/.test(text)) return 'business'
  if (/生活|健康|家居|寵物|關係/.test(text)) return 'lifestyle'
  if (/文化|潮流|熱話/.test(text)) return 'news-culture'
  return null
}

export async function syncEggTopicsToCore() {
  const response = await fetch(EGG_TOPICS_URL, { cache: 'no-store', signal: AbortSignal.timeout(8_000) })
  if (!response.ok) throw new Error(`EGG topic feed ${response.status}`)
  const payload = await response.json() as { topics?: EggTopic[] }
  const topics = Array.isArray(payload.topics) ? payload.topics : []
  const valid = topics.filter((topic) => cleanString(topic.id, 80) && cleanString(topic.title, 180))
  if (!valid.length) return { imported: 0, total: 0 }

  const admin = createSupabaseAdmin()
  const ids = valid.map((topic) => cleanString(topic.id, 80))
  const { data: existing, error: readError } = await admin.from('topic_items').select('id').in('id', ids)
  if (readError) throw readError
  const existingIds = new Set((existing ?? []).map((row) => row.id))
  const missing = valid.filter((topic) => !existingIds.has(cleanString(topic.id, 80)))
  if (!missing.length) return { imported: 0, total: valid.length }

  const rows = missing.map((topic) => {
    const id = cleanString(topic.id, 80)
    const publishedAt = cleanString(topic.published_at, 80) || new Date().toISOString()
    const source = topic.topic_sources?.[0]
    const keywords = cleanStringArray(topic.keywords, 30, 80)
    const category = cleanString(topic.topic_item_directions?.[0]?.topic_directions?.label_zh, 80)
    return {
      id,
      slug: `egg-${id}`,
      title: cleanString(topic.title, 180),
      summary: cleanString(topic.summary, 1200),
      why_now: '由 EGG 創作者社群共享到 SOON 中央題材庫。',
      hook: cleanString(topic.title, 500),
      suggested_angles: [], content_formats: cleanStringArray(topic.content_formats, 10, 40),
      countries: [], regions: [], localities: [], languages: ['zh-HK'],
      keywords: [...new Set([category, ...keywords].filter(Boolean))],
      cover_url: cleanString(topic.cover_url, 1000) || null,
      cover_alt: cleanString(topic.title, 240), status: 'published',
      published_at: publishedAt, updated_at: publishedAt,
      source_url: cleanString(source?.url, 1000), source_name: cleanString(source?.source_name, 160),
      direction_id: directionFor(topic),
    }
  })
  const topicRows = rows.map(({ source_url, source_name, direction_id, ...row }) => row)
  const { error: insertError } = await admin.from('topic_items').insert(topicRows)
  if (insertError) throw insertError

  const sources = rows.filter((row) => row.source_url).map((row) => ({
    topic_id: row.id, url: row.source_url, source_name: row.source_name || 'EGG 社群',
    source_title: row.title, published_at: row.published_at, notes: '由 EGG 題材靈感庫自動共享。',
  }))
  if (sources.length) await admin.from('topic_sources').upsert(sources, { onConflict: 'topic_id,url' })
  const directions = rows.filter((row) => row.direction_id).map((row) => ({
    topic_id: row.id, direction_id: row.direction_id as string, is_primary: true, confidence: 0.7,
  }))
  if (directions.length) await admin.from('topic_item_directions').upsert(directions, { onConflict: 'topic_id,direction_id' })
  return { imported: rows.length, total: valid.length }
}
