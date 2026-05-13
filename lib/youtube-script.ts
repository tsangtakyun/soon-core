export type YouTubeScriptLanguage = 'zh' | 'en'

export type SegmentType =
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

export type BlockType =
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

export type ScriptBlock = {
  id: string
  type: BlockType | null
  speaker: string
  content: string
}

export type ScriptSegment = {
  id: string
  type: SegmentType
  title: string
  blocks: ScriptBlock[]
}

export type YouTubeScriptContent = {
  language: YouTubeScriptLanguage
  title: string
  releaseDate: string
  creator: string
  guest: string
  location: string
  series: string
  format: string
  coverImage: string
  scriptTitle: string
  segments: ScriptSegment[]
  createdAt: string
  updatedAt: string
}

export const youtubeScriptLangStorageKey = 'soon-youtube-script-lang'

export const segmentTypeColors: Record<SegmentType, string> = {
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

export const blockTypeColors: Record<BlockType, string> = {
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

export const segmentTypeOptions = Object.keys(segmentTypeColors) as SegmentType[]
export const blockTypeOptions = Object.keys(blockTypeColors) as BlockType[]

const legacySegmentTypeMap: Record<string, SegmentType> = {
  Statement: 'hook',
  Bridge: 'turning_point',
  Info: 'fun_fact',
  Challenge: 'challenge',
  Experiment: 'real_test',
  Ending: 'ending',
  Others: 'other',
}

const legacyBlockTypeMap: Record<string, BlockType> = {
  camera: 'dialogue',
  vo: 'voiceover',
  visual: 'scene',
  behind: 'behind',
  insert: 'insert_ad',
  other: 'other',
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

function normaliseSegmentType(type: unknown): SegmentType {
  if (typeof type !== 'string') return 'hook'
  if (type in segmentTypeColors) return type as SegmentType
  return legacySegmentTypeMap[type] ?? 'hook'
}

function normaliseBlockType(type: unknown): BlockType | null {
  if (type === null || type === undefined || type === '') return null
  if (typeof type !== 'string') return null
  if (type in blockTypeColors) return type as BlockType
  return legacyBlockTypeMap[type] ?? null
}

export function createEmptyBlock(type: BlockType | null = null): ScriptBlock {
  return {
    id: makeId(),
    type,
    speaker: '',
    content: '',
  }
}

export function createEmptySegment(): ScriptSegment {
  return {
    id: makeId(),
    type: 'hook',
    title: '',
    blocks: [createEmptyBlock()],
  }
}

export function createEmptyYouTubeScript(language: YouTubeScriptLanguage = 'zh'): YouTubeScriptContent {
  const now = new Date().toISOString()
  return {
    language,
    title: 'YouTube Script',
    releaseDate: '',
    creator: '',
    guest: '',
    location: '',
    series: '',
    format: '',
    coverImage: '',
    scriptTitle: '',
    segments: [createEmptySegment()],
    createdAt: now,
    updatedAt: now,
  }
}

export function parseYouTubeScript(content: string | null, fallbackLanguage: YouTubeScriptLanguage) {
  if (!content) return createEmptyYouTubeScript(fallbackLanguage)

  try {
    const parsed = JSON.parse(content) as Partial<YouTubeScriptContent>
    const fallback = createEmptyYouTubeScript(fallbackLanguage)
    const parsedSegments = Array.isArray(parsed.segments) ? parsed.segments : []
    return {
      ...fallback,
      ...parsed,
      language: parsed.language === 'en' || parsed.language === 'zh' ? parsed.language : fallbackLanguage,
      segments:
        parsedSegments.length > 0
          ? parsedSegments.map((segment) => ({
              ...segment,
              type: normaliseSegmentType(segment.type),
              blocks: Array.isArray(segment.blocks)
                ? segment.blocks.map((block) => ({
                    ...block,
                    type: normaliseBlockType(block.type),
                  }))
                : [createEmptyBlock()],
            }))
          : fallback.segments,
      createdAt: parsed.createdAt ?? fallback.createdAt,
      updatedAt: parsed.updatedAt ?? fallback.updatedAt,
    }
  } catch {
    return createEmptyYouTubeScript(fallbackLanguage)
  }
}
