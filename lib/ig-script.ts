export type IGScriptLanguage = 'zh' | 'en'

export type IGSegmentType =
  | 'hook'
  | 'background'
  | 'turning_point'
  | 'real_test'
  | 'product_integration'
  | 'challenge'
  | 'fun_fact'
  | 'emotional_beat'
  | 'comedy_bit'
  | 'street_interview'
  | 'contrast'
  | 'reflection'
  | 'cta'
  | 'ending'
  | 'other'

export type IGBlockType =
  | 'scene'
  | 'dialogue'
  | 'voiceover'
  | 'behind'
  | 'caption'
  | 'music'
  | 'transition'
  | 'action'
  | 'insert_ad'
  | 'data'
  | 'location'
  | 'timestamp'
  | 'other'

export type IGScriptBlock = {
  id: string
  type: IGBlockType | null
  speaker: string
  content: string
}

export type IGScriptSegment = {
  id: string
  type: IGSegmentType
  title: string
  suggestedTime: string
  blocks: IGScriptBlock[]
}

export type IGScriptContent = {
  language: IGScriptLanguage
  title: string
  releaseDate: string
  creator: string
  guest: string
  location: string
  series: string
  format: string
  coverImage: string
  scriptTitle: string
  segments: IGScriptSegment[]
  createdAt: string
  updatedAt: string
}

export const igScriptLangStorageKey = 'soon-ig-script-lang'

export const igSegmentTypeOptions: IGSegmentType[] = [
  'hook',
  'background',
  'turning_point',
  'real_test',
  'product_integration',
  'challenge',
  'fun_fact',
  'emotional_beat',
  'comedy_bit',
  'street_interview',
  'contrast',
  'reflection',
  'cta',
  'ending',
  'other',
]

export const igBlockTypeOptions: IGBlockType[] = [
  'scene',
  'dialogue',
  'voiceover',
  'behind',
  'caption',
  'music',
  'transition',
  'action',
  'insert_ad',
  'data',
  'location',
  'timestamp',
  'other',
]

export const igSegmentTypeColors: Record<IGSegmentType, string> = {
  hook: '#7c3aed',
  background: '#0ea5e9',
  turning_point: '#f97316',
  real_test: '#ef4444',
  product_integration: '#22c55e',
  challenge: '#ec4899',
  fun_fact: '#14b8a6',
  emotional_beat: '#f59e0b',
  comedy_bit: '#8b5cf6',
  street_interview: '#06b6d4',
  contrast: '#84cc16',
  reflection: '#6366f1',
  cta: '#10b981',
  ending: '#6b7280',
  other: '#9ca3af',
}

export const igBlockTypeColors: Record<IGBlockType, string> = {
  scene: '#6b7280',
  dialogue: '#7c3aed',
  voiceover: '#0ea5e9',
  behind: '#f97316',
  caption: '#14b8a6',
  music: '#ec4899',
  transition: '#84cc16',
  action: '#f59e0b',
  insert_ad: '#22c55e',
  data: '#06b6d4',
  location: '#8b5cf6',
  timestamp: '#6366f1',
  other: '#9ca3af',
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

export function createEmptyIGBlock(type: IGBlockType | null = null): IGScriptBlock {
  return {
    id: makeId(),
    type,
    speaker: '',
    content: '',
  }
}

export function createEmptyIGSegment(
  type: IGSegmentType = 'hook',
  title = '',
  suggestedTime = ''
): IGScriptSegment {
  return {
    id: makeId(),
    type,
    title,
    suggestedTime,
    blocks: [createEmptyIGBlock()],
  }
}

export function createDefaultIGSegments() {
  return [
    createEmptyIGSegment('hook', '開場鉤子', '5秒'),
    createEmptyIGSegment('background', '背景鋪陳', '80-100字'),
    createEmptyIGSegment('turning_point', '轉折點', '10秒'),
    createEmptyIGSegment('real_test', '實測體驗', '15-25秒'),
    createEmptyIGSegment('ending', '結尾', '5秒'),
  ]
}

export function createEmptyIGScript(language: IGScriptLanguage = 'zh'): IGScriptContent {
  const now = new Date().toISOString()
  return {
    language,
    title: 'IG Script',
    releaseDate: '',
    creator: '',
    guest: '',
    location: '',
    series: '',
    format: '',
    coverImage: '',
    scriptTitle: '',
    segments: createDefaultIGSegments(),
    createdAt: now,
    updatedAt: now,
  }
}

export function parseIGScript(content: string | null, fallbackLanguage: IGScriptLanguage) {
  if (!content) return createEmptyIGScript(fallbackLanguage)

  try {
    const parsed = JSON.parse(content) as Partial<IGScriptContent>
    const fallback = createEmptyIGScript(fallbackLanguage)
    return {
      ...fallback,
      ...parsed,
      language: parsed.language === 'en' || parsed.language === 'zh' ? parsed.language : fallbackLanguage,
      segments: parsed.segments && parsed.segments.length > 0 ? parsed.segments : fallback.segments,
      createdAt: parsed.createdAt ?? fallback.createdAt,
      updatedAt: parsed.updatedAt ?? fallback.updatedAt,
    }
  } catch {
    return createEmptyIGScript(fallbackLanguage)
  }
}
