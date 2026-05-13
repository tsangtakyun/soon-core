export type YouTubeScriptLanguage = 'zh' | 'en'

export type SegmentType = 'Statement' | 'Bridge' | 'Info' | 'Challenge' | 'Experiment' | 'Ending' | 'Others'

export type BlockType = 'camera' | 'vo' | 'visual' | 'behind' | 'insert' | 'other'

export type ScriptBlock = {
  id: string
  type: BlockType
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
  Statement: '#7c3aed',
  Bridge: '#f97316',
  Info: '#0ea5e9',
  Challenge: '#ef4444',
  Experiment: '#22c55e',
  Ending: '#6b7280',
  Others: '#ec4899',
}

export const blockTypeColors: Record<BlockType, string> = {
  camera: '#7c3aed',
  vo: '#0ea5e9',
  visual: '#6b7280',
  behind: '#f97316',
  insert: '#22c55e',
  other: '#ec4899',
}

export const segmentTypeOptions = Object.keys(segmentTypeColors) as SegmentType[]
export const blockTypeOptions = Object.keys(blockTypeColors) as BlockType[]

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

export function createEmptyBlock(type: BlockType = 'camera'): ScriptBlock {
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
    type: 'Statement',
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
    return {
      ...fallback,
      ...parsed,
      language: parsed.language === 'en' || parsed.language === 'zh' ? parsed.language : fallbackLanguage,
      segments: parsed.segments && parsed.segments.length > 0 ? parsed.segments : fallback.segments,
      createdAt: parsed.createdAt ?? fallback.createdAt,
      updatedAt: parsed.updatedAt ?? fallback.updatedAt,
    }
  } catch {
    return createEmptyYouTubeScript(fallbackLanguage)
  }
}
