export type ConceptBoardLanguage = 'zh' | 'en'

export type ClientBrief = {
  name: string
  content: string
}

export type ConceptIntegrationItem = {
  id: string
  text: string
}

export type ConceptBreakdownRow = {
  id: string
  name: string
  description: string
  time: string
  images: string[]
}

export type ConceptReferenceRow = {
  id: string
  image: string
  title: string
  views: string
  date: string
  url: string
  description: string
}

export type ConceptSection = {
  id: string
  coverImage: string
  title: string
  subtitle: string
  productIntegration: ConceptIntegrationItem[]
  breakdown: ConceptBreakdownRow[]
  references: ConceptReferenceRow[]
}

export type ConceptBoardContent = {
  language: ConceptBoardLanguage
  title: string
  client: string
  project: string
  concepts: ConceptSection[]
  createdAt: string
  updatedAt: string
}

export const conceptBoardLangStorageKey = 'soon-concept-board-lang'

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

export function createEmptyConcept(): ConceptSection {
  return {
    id: makeId(),
    coverImage: '',
    title: '',
    subtitle: '',
    productIntegration: [
      { id: makeId(), text: '' },
      { id: makeId(), text: '' },
      { id: makeId(), text: '' },
    ],
    breakdown: [
      { id: makeId(), name: '', description: '', time: '', images: [] },
      { id: makeId(), name: '', description: '', time: '', images: [] },
      { id: makeId(), name: '', description: '', time: '', images: [] },
    ],
    references: [
      { id: makeId(), image: '', title: '', views: '', date: '', url: '', description: '' },
      { id: makeId(), image: '', title: '', views: '', date: '', url: '', description: '' },
      { id: makeId(), image: '', title: '', views: '', date: '', url: '', description: '' },
    ],
  }
}

export function createEmptyConceptBoard(language: ConceptBoardLanguage = 'zh'): ConceptBoardContent {
  const now = new Date().toISOString()
  return {
    language,
    title: 'Concept Board',
    client: '',
    project: '',
    concepts: [createEmptyConcept()],
    createdAt: now,
    updatedAt: now,
  }
}

export function parseConceptBoard(content: string | null, fallbackLanguage: ConceptBoardLanguage): ConceptBoardContent {
  if (!content) return createEmptyConceptBoard(fallbackLanguage)

  try {
    const parsed = JSON.parse(content) as Partial<ConceptBoardContent>
    const fallback = createEmptyConceptBoard(fallbackLanguage)
    return {
      ...fallback,
      ...parsed,
      language: parsed.language === 'en' || parsed.language === 'zh' ? parsed.language : fallbackLanguage,
      concepts: parsed.concepts && parsed.concepts.length > 0 ? parsed.concepts : fallback.concepts,
      createdAt: parsed.createdAt ?? fallback.createdAt,
      updatedAt: parsed.updatedAt ?? fallback.updatedAt,
    }
  } catch {
    return createEmptyConceptBoard(fallbackLanguage)
  }
}

export function conceptHasContent(concept: ConceptSection) {
  return Boolean(
    concept.coverImage ||
      concept.title.trim() ||
      concept.subtitle.trim() ||
      concept.productIntegration.some((item) => item.text.trim()) ||
      concept.breakdown.some((row) => row.name.trim() || row.description.trim() || row.time.trim() || row.images.length > 0) ||
      concept.references.some((row) => row.image || row.title.trim() || row.views.trim() || row.date.trim() || row.url.trim() || row.description.trim())
  )
}
