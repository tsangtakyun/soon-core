export const STYLE_FORMATS = ['instagram_carousel', 'instagram_single_feed', 'human_short_video', 'ai_short_video'] as const
export type StyleFormat = (typeof STYLE_FORMATS)[number]
export type StyleScope = 'public_research' | 'soon_owned' | 'workspace_private'
export type StyleVersionStatus = 'draft' | 'review' | 'published'

export type StyleRules = Record<string, unknown> & {
  schema_version: number
  format: StyleFormat
}

export type PublishedTemplate = {
  templateId: string
  code: string
  name: string
  version: {
    id: string
    number: number
    ref: string
    rendererCode: string
    contentHash: string
    creatorCommit: string | null
    publishedAt: string
    contract: Record<string, unknown>
  }
}

export type PublishedStyle = {
  styleId: string
  code: string
  format: StyleFormat
  name: string
  description: string
  version: {
    id: string
    number: number
    ref: string
    contentHash: string
    changeSummary: string
    publishedAt: string
    rules: StyleRules
  }
  evidence: { confirmedReferenceCount: number }
  templates: PublishedTemplate[]
}

export type PublishedStylesResponse = {
  schemaVersion: 1
  registryVersion: string
  compatibility: { minimumCreatorContract: 1; supportedFormats: readonly StyleFormat[] }
  format: StyleFormat | null
  updatedAt: string | null
  contentHash: string
  styles: PublishedStyle[]
}
