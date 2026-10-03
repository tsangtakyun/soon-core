export const STYLE_FORMATS = ['instagram_carousel', 'instagram_single_feed', 'human_short_video', 'ai_short_video'] as const
export type StyleFormat = (typeof STYLE_FORMATS)[number]
export type StyleScope = 'public_research' | 'soon_owned' | 'workspace_private'
export type StyleVersionStatus = 'draft' | 'review' | 'published'

export type StyleRules = Record<string, unknown> & {
  schema_version: number
  format: StyleFormat
}

export type HumanVideoBeatField =
  | 'role'
  | 'time'
  | 'visual.description'
  | 'visual.action'
  | 'visual.framing'
  | 'spoken.mode'
  | 'spoken.text'
  | 'subtitle.text'
  | 'shooting.instructions'
  | 'bRoll.brief'
  | 'assetRefs'
  | 'evidence.sourceRefs'

export type HumanVideoScriptStyleContract = {
  contractVersion: 'human_video_script.v2'
  format: 'human_short_video'
  styleCode: string
  styleName?: string
  styleVersionId: string | null
  styleVersionRef: string
  styleContentHash: string
  registryVersion: string
  requiredBeatFields: HumanVideoBeatField[]
  optionalBeatFields: HumanVideoBeatField[]
  beatCountGuidance?: { minimum: number; ideal: number; maximum: number }
  roleProfile?: {
    allowedRoles: string[]
    counts: Record<string, { minimum: number; maximum: number }>
    order: string[]
  }
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
  /** previewAsset is the approved published cover, never a style reference. */
  evidence: { confirmedReferenceCount: number; previewAsset: string | null }
  templates: PublishedTemplate[]
  /** Present only when Core publishes a script contract; listing it does not enable generation. */
  scriptContract?: HumanVideoScriptStyleContract
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
